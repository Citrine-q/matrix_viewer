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
    rowSizeCache: Map<number, number> // ★追加: 行サイズのキャッシュ
): Promise<FetchResult> {
    
    // 1. スレッド・フレーム特定
    const threads = await session.customRequest('threads');
    if (!threads.threads || threads.threads.length === 0) throw new Error('No threads found');
    const threadId = threads.threads[0].id;
    
    const stack = await session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 1 });
    if (!stack.stackFrames || stack.stackFrames.length === 0) throw new Error('No stack frames found');
    const frameId = stack.stackFrames[0].id;

    // 2. 変数再評価
    const topVar = await session.customRequest('evaluate', { expression: varName, frameId, context: 'watch' });

    // 3. 全体のサイズ取得
    let totalRows: number | null = null;
    let totalCols: number | null = null;

    if (topVar.indexedVariables && topVar.indexedVariables > 0) {
        totalRows = topVar.indexedVariables;
    } 
    if (totalRows === null && topVar.result) {
        const match = topVar.result.match(/(?:size|len|count|Length)(?:\s*[:=]\s*|\s+)(\d+)/i);
        if (match) totalRows = parseInt(match[1]);
    }
    if (totalRows === null) {
        totalRows = await evalSize(session, frameId, varName);
    }

    // 4. 行リストの取得
    const rowResp = await session.customRequest('variables', {
        variablesReference: topVar.variablesReference,
        start: rowStart, count: rowCount
    });
    let rawRows = rowResp.variables || [];
    
    if (rawRows.length > rowCount) {
        const end = Math.min(rowStart + rowCount, rawRows.length);
        rawRows = rawRows.slice(rowStart, end);
    }

    let maxRowLengthInChunk = 0;

    // 5. 各行の中身(列)を取得
    const resolvedRows: CellData[][] = await Promise.all(rawRows.map(async (row: any, rowIndexRel: number) => {
        
        let thisRowSize: number | null = null;

        // ★キャッシュチェック
        // variablesReference > 0 (プリミティブでない) 場合のみキャッシュ有効
        if (row.variablesReference > 0 && rowSizeCache.has(row.variablesReference)) {
            thisRowSize = rowSizeCache.get(row.variablesReference)!;
        } else {
            // キャッシュになければ計算する
            
            // A. 軽量チェック
            thisRowSize = getRowSize(row);

            // B. 重量チェック (evalSize)
            if (thisRowSize === null && row.variablesReference > 0) {
                let rowExpr = "";
                if (row.name.startsWith("[")) {
                    rowExpr = `${varName}${row.name}`;
                } else {
                    rowExpr = `${varName}[${row.name}]`;
                }
                thisRowSize = await evalSize(session, frameId, rowExpr);
            }

            // ★結果をキャッシュに保存
            if (thisRowSize !== null && row.variablesReference > 0) {
                rowSizeCache.set(row.variablesReference, thisRowSize);
            }
        }

        // maxRowLengthの更新
        if (thisRowSize !== null && thisRowSize > maxRowLengthInChunk) {
            maxRowLengthInChunk = thisRowSize;
        }

        // 境界チェック (サイズが確定していて範囲外ならリクエストしない)
        if (thisRowSize !== null && colStart >= thisRowSize) {
            return [];
        }

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

        // データ取得リクエスト
        let rawCols: any[] = [];
        const colsResp = await session.customRequest('variables', {
            variablesReference: row.variablesReference,
            start: colStart, count: colCount
        });
        rawCols = colsResp.variables || [];
        
        if (rawCols.length > colCount) {
            const end = Math.min(colStart + colCount, rawCols.length);
            rawCols = rawCols.slice(colStart, end);
        }

        return rawCols.map((c: any, colIndexRel: number) => {
            const currentColIndex = colStart + colIndexRel;
            const currentRowIndex = rowStart + rowIndexRel;
            const cellKey = `${currentRowIndex}:${currentColIndex}`;
            const newValue = c.value || "null";
            
            let changed = false;
            if (snapshot.has(cellKey)) {
                const oldValue = snapshot.get(cellKey);
                if (oldValue !== newValue) changed = true;
            }
            snapshot.set(cellKey, newValue);

            return { value: newValue, changed: changed };
        });
    }));

    return {
        data: resolvedRows,
        rows: totalRows,
        cols: totalCols,
        maxRowLength: maxRowLengthInChunk
    };
}

function getRowSize(row: any): number | null {
    if (typeof row.indexedVariables === 'number' && row.indexedVariables > 0) {
        return row.indexedVariables;
    }
    if (row.result) {
        const match = row.result.match(/(?:size|len|count|Length)(?:\s*[:=]\s*|\s+)(\d+)/i);
        if (match) return parseInt(match[1]);
        const arrayMatch = row.result.match(/\[(\d+)\]/);
        if (arrayMatch) return parseInt(arrayMatch[1]);
    }
    return null;
}

async function evalSize(session: vscode.DebugSession, frameId: number, expression: string): Promise<number | null> {
    const candidates = [
        `${expression}.size()`, `len(${expression})`, `${expression}.len()`, `${expression}.len`,
        `${expression}.length`, `${expression}.Count`, `${expression}.Length`
    ];
    for (const expr of candidates) {
        try {
            const res = await session.customRequest('evaluate', { expression: expr, frameId, context: 'watch' });
            const val = parseInt(res.result);
            if (!isNaN(val)) return val;
        } catch (e) {}
    }
    return null;
}