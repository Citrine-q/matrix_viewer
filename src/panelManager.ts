// src/panelManager.ts
import * as vscode from 'vscode';
import { getLazyWebviewContent } from './matrixView';
import { fetchFreshMatrixChunkWithDiff } from './debugAdapter';

// パネル情報
interface PanelEntry {
    panel: vscode.WebviewPanel;
    varName: string;
    // キー: "行インデックス:列インデックス", 値: 変数の値(文字列)
    snapshot: Map<string, string>;
}

export class PanelManager {
    private activePanels: PanelEntry[] = [];

    // パネルを新規作成する
    public createPanel(session: vscode.DebugSession, variableName: string) {
        const panel = vscode.window.createWebviewPanel(
            'matrixViewer',
            `Matrix: ${variableName}`,
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        const panelEntry: PanelEntry = { panel, varName: variableName, snapshot: new Map() };
        this.activePanels.push(panelEntry);

        panel.onDidDispose(() => {
            const index = this.activePanels.indexOf(panelEntry);
            if (index > -1) this.activePanels.splice(index, 1);
        });

        // HTML設定
        panel.webview.html = getLazyWebviewContent(variableName);

        // メッセージ受信
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'fetchChunk') {
                try {
                    // DebugAdapter にデータ取得を依頼
                    const result = await fetchFreshMatrixChunkWithDiff(
                        session,
                        variableName,
                        message.rowStart,
                        message.rowCount,
                        message.colStart,
                        message.colCount,
                        panelEntry.snapshot
                    );

                    // 結果をWebViewに返す
                    panel.webview.postMessage({
                        command: 'appendData',
                        mode: message.mode,
                        data: result.data,
                        rowStart: message.rowStart,
                        colStart: message.colStart,
                        totalRows: result.rows,
                        totalCols: result.cols
                    });
                } catch (e) {
                    console.error('Fetch error:', e);
                }
            }
        });

        // 初回ロード
        this.refreshPanel(session, panelEntry);
    }

    // 全パネルを更新
    public async refreshAll(session: vscode.DebugSession) {
        for (const entry of this.activePanels) {
            await this.refreshPanel(session, entry);
        }
    }

    // 特定のパネルに更新指示を送る
    private async refreshPanel(session: vscode.DebugSession, entry: PanelEntry) {
        entry.panel.webview.postMessage({ command: 'refreshSignal' });
    }
    
    // 全パネルを破棄（終了時など）
    public dispose() {
        this.activePanels.forEach(p => p.panel.dispose());
        this.activePanels = [];
    }
}