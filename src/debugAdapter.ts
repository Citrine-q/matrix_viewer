// src/debugAdapter.ts
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

    // 3. サイズ取得
    let totalRows: number | null = null;
    let totalCols: number | null = null;
    if (topVar.indexedVariables && topVar.indexedVariables > 0) {
        totalRows = topVar.indexedVariables;
    } else {
        try {
            const r = await session.customRequest('evaluate', { expression: `${varName}.size()`, frameId, context: 'watch' });
            const v = parseInt(r.result);
            if (!isNaN(v)) totalRows = v;
        } catch (e) {}
    }
    if (totalRows && totalRows > 0) {
        try {
            const row0 = await session.customRequest('evaluate', { expression: `${varName}[0]`, frameId, context: 'watch' });
            if (row0.indexedVariables) totalCols = row0.indexedVariables;
            else {
                const r = await session.customRequest('evaluate', { expression: `${varName}[0].size()`, frameId, context: 'watch' });
                const v = parseInt(r.result);
                if (!isNaN(v)) totalCols = v;
            }
        } catch (e) {}
    }

    // 4. 行データの取得
    const rowResp = await session.customRequest('variables', {
        variablesReference: topVar.variablesReference,
        start: rowStart, count: rowCount
    });
    let rawRows = rowResp.variables || [];
    if (rawRows.length > rowCount) {
        const end = Math.min(rowStart + rowCount, rawRows.length);
        rawRows = rawRows.slice(rowStart, end);
    }

    // 5. 各行の中身(列)を取得し、差分を検知する
    const resolvedRows: CellData[][] = await Promise.all(rawRows.map(async (row: any, rowIndexRel: number) => {
        const currentRowIndex = rowStart + rowIndexRel; // 絶対的な行番号

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

        // 値の抽出と、スナップショットとの比較
        return rawCols.map((c: any, colIndexRel: number) => {
            const currentColIndex = colStart + colIndexRel; // 絶対的な列番号
            const cellKey = `${currentRowIndex}:${currentColIndex}`; // マップのキー
            const newValue = c.value;
            
            let changed = false;
            // スナップショットに過去の値があり、かつ値が異なる場合
            if (snapshot.has(cellKey)) {
                const oldValue = snapshot.get(cellKey);
                if (oldValue !== newValue) {
                    changed = true;
                }
            }
            
            // スナップショットを最新の値で更新
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