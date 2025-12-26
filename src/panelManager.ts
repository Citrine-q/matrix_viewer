import * as vscode from 'vscode';
import { getLazyWebviewContent } from './matrixView';
import { fetchFreshMatrixChunkWithDiff } from './debugAdapter';

interface PanelEntry {
    panel: vscode.WebviewPanel;
    varName: string;
    snapshot: Map<string, string>;
    rowSizeCache: Map<number, number>; // ★追加
}

export class PanelManager {
    private activePanels: PanelEntry[] = [];

    public createPanel(session: vscode.DebugSession, variableName: string) {
        const panel = vscode.window.createWebviewPanel(
            'matrixViewer',
            `Matrix: ${variableName}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        const panelEntry: PanelEntry = { 
            panel, 
            varName: variableName, 
            snapshot: new Map(),
            rowSizeCache: new Map() // ★初期化
        };
        this.activePanels.push(panelEntry);

        panel.onDidDispose(() => {
            const index = this.activePanels.indexOf(panelEntry);
            if (index > -1) this.activePanels.splice(index, 1);
        });

        panel.webview.html = getLazyWebviewContent(variableName);

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'fetchChunk') {
                try {
                    const result = await fetchFreshMatrixChunkWithDiff(
                        session,
                        variableName,
                        message.rowStart,
                        message.rowCount,
                        message.colStart,
                        message.colCount,
                        panelEntry.snapshot,
                        panelEntry.rowSizeCache // ★渡す
                    );

                    panel.webview.postMessage({
                        command: 'appendData',
                        mode: message.mode,
                        data: result.data,
                        rowStart: message.rowStart,
                        colStart: message.colStart,
                        totalRows: result.rows,
                        totalCols: result.cols,
                        maxRowLength: result.maxRowLength
                    });
                } catch (e) {
                    console.error('Fetch error:', e);
                }
            }
        });

        this.refreshPanel(session, panelEntry);
    }

    public async refreshAll(session: vscode.DebugSession) {
        for (const entry of this.activePanels) {
            await this.refreshPanel(session, entry);
        }
    }

    private async refreshPanel(session: vscode.DebugSession, entry: PanelEntry) {
        // ステップ実行などで更新された場合、キャッシュをクリアするかどうかは選択肢ですが
        // variablesReferenceが変わればキャッシュはヒットしないので、そのままでも問題ありません。
        // もし厳密にやるならここで entry.rowSizeCache.clear() を呼んでも良いです。
        entry.panel.webview.postMessage({ command: 'refreshSignal' });
    }
    
    public dispose() {
        this.activePanels.forEach(p => p.panel.dispose());
        this.activePanels = [];
    }
}