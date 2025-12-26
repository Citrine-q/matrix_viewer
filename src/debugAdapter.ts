import * as vscode from 'vscode';

export interface CellData {
    value: string;
    changed: boolean;
}

export interface FetchResult {
    data: CellData[][];
    rows: number | null;
    cols: number | null;
    maxRowLength: number;
}

export async function fetchFreshMatrixChunkWithDiff(
    session: vscode.DebugSession,
    varName: string,
    rowStart: number, rowCount: number,
    colStart: number, colCount: number,
    snapshot: Map<string, string>,
    rowSizeCache: Map<number, number>
): Promise<FetchResult> {
    
    // ... (1. スレッド特定 〜 4. 行リスト取得 までは変更なし) ...
    // 1. スレッド・フレーム特定
    const threads = await session.customRequest('threads');
    if (!threads.threads || threads.threads.length === 0) throw new Error('No threads found');
    const threadId = threads.threads[0].id;
    const stack = await session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 1 });
    if (!stack.stackFrames || stack.stackFrames.length === 0) throw new Error('No stack frames found');
    const frameId = stack.stackFrames[0].id;
    const topVar = await session.customRequest('evaluate', { expression: varName, frameId, context: 'watch' });

    // 3. サイズ取得
    let totalRows: number | null = null;
    let totalCols: number | null = null;
    if (topVar.indexedVariables && topVar.indexedVariables > 0) totalRows = topVar.indexedVariables;
    if (totalRows === null && topVar.result) {
        const match = topVar.result.match(/(?:size|len|count|Length)(?:\s*[:=]\s*|\s+)(\d+)/i);
        if (match) totalRows = parseInt(match[1]);
    }
    if (totalRows === null) totalRows = await evalSize(session, frameId, varName);

    // 4. 行リスト取得
    const rowResp = await session.customRequest('variables', {
        variablesReference: topVar.variablesReference,
        start: rowStart, count: rowCount
    });
    let rawRows = rowResp.variables || [];
    if (rawRows.length > rowCount) rawRows = rawRows.slice(0, rowCount);

    let maxRowLengthInChunk = 0;

    // 5. 各行の中身(列)を取得
    const resolvedRows: CellData[][] = await Promise.all(rawRows.map(async (row: any, rowIndexRel: number) => {
        
        // --- サイズチェック (前回と同じ) ---
        let thisRowSize: number | null = null;
        if (row.variablesReference > 0 && rowSizeCache.has(row.variablesReference)) {
            thisRowSize = rowSizeCache.get(row.variablesReference)!;
        } else {
            thisRowSize = getRowSize(row);
            if (thisRowSize === null && row.variablesReference > 0) {
                let rowExpr = row.name.startsWith("[") ? `${varName}${row.name}` : `${varName}[${row.name}]`;
                thisRowSize = await evalSize(session, frameId, rowExpr);
            }
            if (thisRowSize !== null && row.variablesReference > 0) {
                rowSizeCache.set(row.variablesReference, thisRowSize);
            }
        }

        if (thisRowSize !== null && thisRowSize > maxRowLengthInChunk) maxRowLengthInChunk = thisRowSize;
        if (thisRowSize !== null && colStart >= thisRowSize) return [];

        // プリミティブ型
        if (row.variablesReference === 0) {
            if (colStart === 0) {
                const val = row.value || "null";
                const cellKey = `${rowStart + rowIndexRel}:${colStart}`;
                let changed = false;
                if (snapshot.has(cellKey) && snapshot.get(cellKey) !== val) changed = true;
                snapshot.set(cellKey, val);
                return [{ value: val, changed }];
            } else {
                return [];
            }
        }

        // --- データ取得 ---
        let rawCols: any[] = [];
        const colsResp = await session.customRequest('variables', {
            variablesReference: row.variablesReference,
            start: colStart, count: colCount
        });
        rawCols = colsResp.variables || [];
        if (rawCols.length > colCount) rawCols = rawCols.slice(0, colCount);

        // ★修正: 個々のセル(オブジェクト)の中身を展開する処理を追加
        return await Promise.all(rawCols.map(async (c: any, colIndexRel: number) => {
            const currentColIndex = colStart + colIndexRel;
            const currentRowIndex = rowStart + rowIndexRel;
            const cellKey = `${currentRowIndex}:${currentColIndex}`;
            
            // ★オブジェクトの中身をプレビュー作成
            const displayValue = await resolveObjectPreview(session, c);
            
            let changed = false;
            if (snapshot.has(cellKey)) {
                const oldValue = snapshot.get(cellKey);
                if (oldValue !== displayValue) changed = true;
            }
            snapshot.set(cellKey, displayValue);

            return { value: displayValue, changed: changed };
        }));
    }));

    return {
        data: resolvedRows,
        rows: totalRows,
        cols: totalCols,
        maxRowLength: maxRowLengthInChunk
    };
}

/**
 * オブジェクトの中身を少しだけ覗いて文字列化する関数
 * 例: "{ x: 1, y: 2, ... }"
 */
async function resolveObjectPreview(session: vscode.DebugSession, variable: any): Promise<string> {
    let baseValue = variable.value || "null";
    
    // 1. もし子供がいない(プリミティブ)なら、そのままの値を返す
    if (!variable.variablesReference || variable.variablesReference === 0) {
        return baseValue;
    }

    // 2. もし既に良い感じの表示(例: "Point(10, 20)")になっていれば、それを採用
    // (中括弧を含まない、かつ "Object" でない場合などはそのまま使う等の判定)
    // ここでは簡易的に「{...}」や「Object」のような抽象的な値の場合のみ展開する方針にします
    const isGeneric = baseValue.match(/^\{.*\}$/) || baseValue.includes("Object") || baseValue.startsWith("0x");
    
    // 展開したくない場合はそのまま返す (パフォーマンス調整のため)
    // if (!isGeneric) return baseValue; 

    try {
        // 3. 子供を取得 (最初の3件くらいまで)
        const propsResp = await session.customRequest('variables', {
            variablesReference: variable.variablesReference,
            start: 0, 
            count: 3 // ★パフォーマンスのため最大3つまで
        });
        
        const props = propsResp.variables || [];
        if (props.length === 0) return baseValue;

        // "key: value" の形式にする
        const propsStr = props.map((p: any) => `${p.name}: ${p.value}`).join(", ");
        
        // 省略記号をつける
        const suffix = (props.length >= 3) ? ", ..." : "";
        
        return `{ ${propsStr}${suffix} }`;

    } catch (e) {
        return baseValue;
    }
}

// ... (以下、getRowSize と evalSize は変更なし) ...
function getRowSize(row: any): number | null {
    if (typeof row.indexedVariables === 'number' && row.indexedVariables > 0) return row.indexedVariables;
    if (row.result) {
        const match = row.result.match(/(?:size|len|count|Length)(?:\s*[:=]\s*|\s+)(\d+)/i);
        if (match) return parseInt(match[1]);
        const arrayMatch = row.result.match(/\[(\d+)\]/);
        if (arrayMatch) return parseInt(arrayMatch[1]);
    }
    return null;
}

async function evalSize(session: vscode.DebugSession, frameId: number, expression: string): Promise<number | null> {
    const candidates = [`${expression}.size()`, `len(${expression})`, `${expression}.len()`, `${expression}.len`, `${expression}.length`, `${expression}.Count`, `${expression}.Length`];
    for (const expr of candidates) {
        try {
            const res = await session.customRequest('evaluate', { expression: expr, frameId, context: 'watch' });
            const val = parseInt(res.result);
            if (!isNaN(val)) return val;
        } catch (e) {}
    }
    return null;
}