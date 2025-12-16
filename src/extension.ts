// src/extension.ts
import * as vscode from 'vscode';
import { PanelManager } from './panelManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('[MatrixViewer] Extension activated.');

    // マネージャーのインスタンス作成
    const manager = new PanelManager();

    // 1. デバッガのイベント監視
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
        createDebugAdapterTracker(session: vscode.DebugSession) {
            return {
                onDidSendMessage: message => {
                    if (message.type === 'event' && message.event === 'stopped') {
                        console.log('[MatrixViewer] Debugger stopped. Refreshing views...');
                        manager.refreshAll(session);
                    }
                }
            };
        }
    });

    // 2. コマンド登録
    let disposable = vscode.commands.registerCommand('matrix-viewer.viewMatrix', async (args) => {
        let variableName: string | undefined;

        if (args && args.variable) {
            variableName = args.variable.evaluateName || args.variable.name;
        } else {
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                variableName = editor.document.getText(editor.selection);
            }
        }

        if (!variableName) {
            variableName = await vscode.window.showInputBox({
                placeHolder: 'Example: grid, matrix',
                prompt: 'Enter the variable name to visualize'
            });
        }
        if (!variableName) return;

        const session = vscode.debug.activeDebugSession;
        if (!session) {
            vscode.window.showErrorMessage('No active debug session found.');
            return;
        }

        // マネージャーにパネル作成を依頼
        manager.createPanel(session, variableName);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}