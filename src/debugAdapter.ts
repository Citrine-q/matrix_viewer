import * as vscode from 'vscode';

// セルのデータ構造
export interface CellData {
    value: string;
    changed: boolean;
}

// データ取得結果の型
export interface FetchResult {
    data: CellData[][];
    rows: number | null;
    cols: number | null;
}

/**
 * 指定範囲のデータを取得し、スナップショットと比較して差分を検知する関数
 */
export async function fetchFreshMatrixChunkWithDiff(
    session: vscode.DebugSession,
    varName: string,
    rowStart: number, rowCount: number,
    colStart: number, colCount: number,
    snapshot: Map<string, string>
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

    // -----------------------------------------------------
    // 3. 多言語対応: サイズ取得ロジック (強化版)
    // -----------------------------------------------------
    let totalRows: number | null = null;
    let totalCols: number | null = null;

    // A. デバッガが要素数(indexedVariables)を教えてくれる場合 (最優先)
    if (topVar.indexedVariables && topVar.indexedVariables > 0) {
        totalRows = topVar.indexedVariables;
    } 
    
    // B. Rust対応: "result" 文字列 (例: "Vec(size=5)") からパースする (★新規追加)
    // CodeLLDBなどのRustデバッガは、indexedVariablesを返さなくてもresultにサイズを書くことが多い
    if (totalRows === null && topVar.result) {
        const match = topVar.result.match(/(?:size|len|count)\s*=\s*(\d+)/i);
        if (match) {
            totalRows = parseInt(match[1]);
        }
    }

    // C. それでもダメなら総当りコマンド実行
    if (totalRows === null) {
        totalRows = await evalSize(session, frameId, varName);
    }

    // --- 列数の取得 ---
    if (totalRows && totalRows > 0) {
        try {
            const row0Name = `${varName}[0]`;
            const row0 = await session.customRequest('evaluate', { expression: row0Name, frameId, context: 'watch' });
            
            if (row0.indexedVariables) {
                totalCols = row0.indexedVariables;
            } else if (row0.result) {
                 // 列側も正規表現チェック
                 const match = row0.result.match(/(?:size|len|count)\s*=\s*(\d+)/i);
                 if (match) totalCols = parseInt(match[1]);
            }
            
            if (totalCols === null) {
                totalCols = await evalSize(session, frameId, row0Name);
            }
        } catch (e) { /* 列数不明は無視 */ }
    }

    // -----------------------------------------------------
    // 4. データ取得
    // -----------------------------------------------------
    
    // 行データの取得
    const rowResp = await session.customRequest('variables', {
        variablesReference: topVar.variablesReference,
        start: rowStart, count: rowCount
    });
    let rawRows = rowResp.variables || [];
    
    if (rawRows.length > rowCount) {
        const end = Math.min(rowStart + rowCount, rawRows.length);
        rawRows = rawRows.slice(rowStart, end);
    }

    // 各行の中身(列)を取得し、差分を検知する
    const resolvedRows: CellData[][] = await Promise.all(rawRows.map(async (row: any, rowIndexRel: number) => {
        const currentRowIndex = rowStart + rowIndexRel;

        let rawCols: any[] = [];
        if (row.variablesReference > 0) {
            const colsResp = await session.customRequest('variables', {
                variablesReference: row.variablesReference,
                start: colStart, count: colCount
            });
            rawCols = colsResp.variables || [];
            if (rawCols.length > colCount) {
                const end = Math.min(colStart + colCount, rawCols.length);
                rawCols = rawCols.slice(colStart, end);
            }
        } else {
            rawCols = [row];
        }

        return rawCols.map((c: any, colIndexRel: number) => {
            const currentColIndex = colStart + colIndexRel;
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
        cols: totalCols
    };
}

/**
 * 言語判定を行わず、あらゆる可能性のあるサイズ取得コマンドを順番に試す関数
 */
async function evalSize(session: vscode.DebugSession, frameId: number, expression: string): Promise<number | null> {
    
    // 試行するパターンのリスト (Rust対応強化)
    const candidates = [
        `${expression}.size()`,  // C++
        `len(${expression})`,    // Python
        `${expression}.len()`,   // Rust (メソッド)
        `${expression}.len`,     // ★Rust (フィールドアクセス - 括弧なし)
        `${expression}.length`,  // JS/TS
        `${expression}.Count`,   // C#
        `${expression}.Length`,  // C#
        `sizeof(${expression})/sizeof(${expression}[0])` // C/C++ Raw Array
    ];

    for (const expr of candidates) {
        try {
            const res = await session.customRequest('evaluate', { 
                expression: expr, 
                frameId, 
                context: 'watch' 
            });

            const val = parseInt(res.result);
            if (!isNaN(val)) {
                return val;
            }
        } catch (e) {
            // 無視して次へ
        }
    }
    
    return null;
}