// src/matrixView.ts

export function getLazyWebviewContent(varName: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: var(--vscode-font-family); background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); margin: 0; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        #header { padding: 8px 12px; background: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; }
        #container { flex-grow: 1; overflow: auto; position: relative; padding: 10px; padding-bottom: 50px; }
        table { border-collapse: separate; border-spacing: 0; table-layout: fixed; }
        th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 8px; text-align: center; white-space: nowrap; height: 24px; min-width: 40px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; }
        thead th { position: sticky; top: 0; z-index: 10; background-color: var(--vscode-editor-inactiveSelectionBackground); box-shadow: 0 1px 0 var(--vscode-panel-border); }
        tbody th { position: sticky; left: 0; z-index: 5; background-color: var(--vscode-editor-inactiveSelectionBackground); color: var(--vscode-descriptionForeground); box-shadow: 1px 0 0 var(--vscode-panel-border); }
        thead th:first-child { left: 0; z-index: 20; background-color: var(--vscode-editor-inactiveSelectionBackground); }
        
        /* 更新ハイライト用アニメーション */
        .updated { animation: flash 1.5s ease-out; font-weight: bold; }
        @keyframes flash { 
            0% { background-color: rgba(255, 255, 0, 0.7); color: black; } 
            100% { background-color: transparent; } 
        }

        .btn { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; cursor: pointer; font-size: 12px; border-radius: 2px; }
        .btn:hover { background-color: var(--vscode-button-hoverBackground); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        #loadRowBtn { display: block; width: 100%; margin-top: 15px; padding: 8px; background: var(--vscode-editorWidget-background); border: 1px dashed var(--vscode-panel-border); color: var(--vscode-foreground); }
        #loadRowBtn:hover { background: var(--vscode-list-hoverBackground); }
        .col-add-btn { cursor: pointer; font-weight: bold; color: var(--vscode-textLink-foreground); }
        .col-add-btn.hidden { display: none; }
        .icon-btn { background: none; border: none; color: var(--vscode-icon-foreground); cursor: pointer; padding: 4px; margin-left: 8px; font-size: 16px; }
        .icon-btn:hover { color: var(--vscode-foreground); background-color: var(--vscode-toolbar-hoverBackground); border-radius: 4px; }
        #overlay { position: absolute; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 100; color: white; font-weight: bold;}
    </style>
</head>
<body>
    <div id="header">
        <div style="display:flex; align-items:center;">
            <strong>${varName}</strong> 
            <span id="sizeInfo" style="font-size:0.9em; color:#888; margin-left: 8px;"></span>
            <button class="icon-btn" onclick="manualReload()" title="Refresh Data">↻</button>
        </div>
        <div id="status" style="font-size:0.9em; color:#888;">Ready</div>
    </div>
    
    <div id="container">
        <div id="overlay">Updating...</div>
        <table id="matrixTable">
            <thead id="tableHead"></thead>
            <tbody id="tableBody"></tbody>
        </table>
        <button id="loadRowBtn" class="btn">Load More Rows ▼</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const ROW_BATCH = 20; 
        const COL_BATCH = 10;
        
        let loadedRows = 0; let loadedCols = 0; let isLoading = false;
        let totalRows = null; let totalCols = null;

        const tableHead = document.getElementById('tableHead');
        const tableBody = document.getElementById('tableBody');
        const loadRowBtn = document.getElementById('loadRowBtn');
        const statusDiv = document.getElementById('status');
        const sizeInfo = document.getElementById('sizeInfo');
        const overlay = document.getElementById('overlay');

        function fetchMoreRows() {
            if (isLoading) return;
            if (totalRows !== null && loadedRows >= totalRows) return;
            setLoading(true);
            let count = ROW_BATCH;
            if (totalRows !== null) count = Math.min(ROW_BATCH, totalRows - loadedRows);
            vscode.postMessage({
                command: 'fetchChunk', mode: 'rows',
                rowStart: loadedRows, rowCount: count,
                colStart: 0, colCount: Math.max(loadedCols, COL_BATCH)
            });
        }

        function fetchMoreCols() {
            if (isLoading || loadedRows === 0) return;
            if (totalCols !== null && loadedCols >= totalCols) return;
            setLoading(true);
            let count = COL_BATCH;
            if (totalCols !== null) count = Math.min(COL_BATCH, totalCols - loadedCols);
            vscode.postMessage({
                command: 'fetchChunk', mode: 'cols',
                rowStart: 0, rowCount: loadedRows,
                colStart: loadedCols, colCount: count
            });
        }

        function reloadView() {
            overlay.style.display = 'flex';
            tableHead.innerHTML = '';
            tableBody.innerHTML = '';
            loadedRows = 0;
            loadedCols = 0; 
            fetchMoreRows();
        }
        function manualReload() { reloadView(); }

        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'refreshSignal') { reloadView(); return; }
            if (msg.command === 'appendData') {
                overlay.style.display = 'none';
                const matrix = msg.data;
                totalRows = msg.totalRows || null;
                totalCols = msg.totalCols || null;
                updateSizeInfo();

                if (msg.mode === 'rows') {
                    if (matrix.length > 0) {
                        if (loadedRows === 0) {
                            if (loadedCols === 0) loadedCols = matrix[0].length;
                            renderHeader(loadedCols);
                        }
                        appendRowsToTable(matrix, msg.rowStart);
                        loadedRows += matrix.length;
                    }
                } else if (msg.mode === 'cols') {
                    if (matrix.length > 0 && matrix[0].length > 0) {
                        const newCount = matrix[0].length;
                        updateHeader(loadedCols, newCount);
                        appendColsToTable(matrix);
                        loadedCols += newCount;
                    }
                }
                setLoading(false);
                checkLimits();
            }
        });

        function renderHeader(count) {
            let html = '<tr><th>#</th>';
            for(let i=0; i<count; i++) html += \`<th>[\${i}]</th>\`;
            html += \`<th class="col-add-btn" onclick="fetchMoreCols()">+</th></tr>\`;
            tableHead.innerHTML = html;
        }

        function updateHeader(start, count) {
            const tr = tableHead.querySelector('tr');
            const btn = tr.lastElementChild;
            for(let i=0; i<count; i++) {
                const th = document.createElement('th');
                th.innerText = \`[\${start + i}]\`;
                tr.insertBefore(th, btn);
            }
        }

        function appendRowsToTable(matrix, startIdx) {
            const frag = document.createDocumentFragment();
            matrix.forEach((row, i) => {
                const tr = document.createElement('tr');
                let html = \`<th>[\${startIdx + i}]</th>\`;
                html += row.map(cell => {
                    const cls = cell.changed ? 'updated' : '';
                    return \`<td class="\${cls}">\${cell.value}</td>\`;
                }).join('');
                tr.innerHTML = html;
                frag.appendChild(tr);
            });
            tableBody.appendChild(frag);
        }

        function appendColsToTable(matrix) {
            const trs = tableBody.querySelectorAll('tr');
            trs.forEach((tr, i) => {
                if(matrix[i]) {
                    matrix[i].forEach(cell => {
                        const td = document.createElement('td');
                        if (cell.changed) { td.className = 'updated'; }
                        td.innerText = cell.value;
                        tr.appendChild(td);
                    });
                }
            });
        }
        
        function checkLimits() {
            if (totalRows !== null && loadedRows >= totalRows) {
                loadRowBtn.innerText = "All rows loaded"; loadRowBtn.disabled = true;
            } else {
                loadRowBtn.innerText = "Load More Rows ▼"; loadRowBtn.disabled = false;
            }
            const btn = document.querySelector('.col-add-btn');
            if(btn) {
                if(totalCols !== null && loadedCols >= totalCols) btn.classList.add('hidden');
                else btn.classList.remove('hidden');
            }
        }
        function updateSizeInfo() { sizeInfo.innerText = \`(Size: \${totalRows ?? '?'} x \${totalCols ?? '?'})\`; }
        function setLoading(b) { isLoading = b; if(b) loadRowBtn.innerText = "Loading..."; }

        loadRowBtn.onclick = fetchMoreRows;
        window.fetchMoreCols = fetchMoreCols;
    </script>
</body>
</html>`;
}