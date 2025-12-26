# Matrix Viewer
日本語は下にあります
**Matrix Viewer** is a powerful debugging visualization tool for VS Code. It allows you to inspect 2D arrays, matrices, vectors, and jagged arrays as a **Grid / Spreadsheet** instead of the standard tree view.

It supports multiple languages including **C++, Python, Rust, JavaScript/TypeScript, C#**, and automatically handles large datasets with lazy loading.



## ✨ Features

* **🌐 Multi-Language Support:**
    * Works out-of-the-box with **C++** (`std::vector`, raw arrays), **Python** (list of lists), **Rust** (`Vec<Vec<T>>`), **JavaScript/TypeScript**, **C#**, and more.
    * **Smart Size Detection:** Automatically attempts multiple strategies (`.size()`, `len()`, `.length`, regex parsing) to determine array dimensions without configuration.

* **⚡ High Performance & Lazy Loading:**
    * Designed for big data. It only fetches the rows and columns currently visible on the screen.
    * Handles **Jagged Arrays** (arrays of varying lengths) correctly by dynamically adjusting the grid layout.
    * **Caching:** Caches row sizes to minimize heavy debug requests during scrolling.

* **🔍 Object Preview:**
    * Displays object content (e.g., `{ x: 1, y: 2 }`) directly in the cell instead of just `[Object]`.
    * Hover over a cell to see the full value in a tooltip.

* **🔄 Live Update & Diff Highlighting:**
    * Automatically refreshes when you step through code.
    * **Highlights changed cells** in yellow to help you track algorithm progress visually.

* **🛡️ Safety Mechanisms:**
    * Prevents out-of-bounds access errors (especially for C++ pointers) by strictly verifying row sizes before fetching data.

## 🚀 Usage

1.  Start a debugging session and hit a breakpoint.
2.  Open the viewer using one of these methods:
    * **Context Menu:** Right-click a variable in the "Variables" view and select **"View as Matrix (2D Table)"**.
    * **Command Palette:** Run `Matrix Viewer: View as Matrix` and enter the variable name (e.g., `grid`, `matrix[0]`, `dp`).

## 🛠 Supported Structures

* **C / C++:** `std::vector<std::vector<T>>`, `T[][]`, `T**` (requires manual size checks sometimes)
* **Python:** `[[1,2], [3,4]]` (List of lists), `numpy` arrays (if convertible to list)
* **Rust:** `Vec<Vec<T>>`, arrays
* **JavaScript / TypeScript:** Array of Arrays, Array of Objects
* **C#:** `List<List<T>>`, 2D Arrays

## ⚠️ Known Limits

* **3D+ Arrays:** Currently supports up to 2 dimensions.
* **Complex Objects:** While object preview is supported, deeply nested objects may appear truncated.

---

# Matrix Viewer (Japanese)

**Matrix Viewer** は、VS Codeでのデバッグ中に、2次元配列や行列（Matrix）、ジャグ配列などをExcelのような**「2次元の表（グリッド）」**形式で可視化する拡張機能です。

標準の「変数ビュー」ではツリー構造で確認しづらいデータも、このツールを使えば一目で全体像を把握できます。

## ✨ 主な機能

* **🌐 多言語対応:**
    * **C++** (`std::vector`, 配列), **Python**, **Rust**, **JavaScript**, **C#** などに対応。
    * **自動サイズ検出:** `.size()` や `len()`、デバッガの出力文字列解析などを総当りで試行し、設定なしで配列サイズを特定します。

* **⚡ 高速な描画 (Lazy Loading):**
    * 必要な部分だけを読み込む「遅延読み込み」を採用。巨大なデータでもフリーズしません。
    * **ジャグ配列（Jagged Array）対応:** 行ごとに長さが異なる配列も、表示崩れやエラーを起こさずに正しく表示します。
    * **キャッシュ機能:** 一度計算した行サイズをキャッシュし、スクロール時の通信負荷を大幅に削減しました。

* **🔍 オブジェクトの中身表示:**
    * セルの中身がオブジェクトの場合、単なる `[Object]` ではなく `{ x: 1, y: 2 }` のように中身を展開して表示します。
    * セルをホバーすると、ツールチップで値を全文確認できます。

* **🔄 自動更新 & 差分ハイライト:**
    * ステップ実行に合わせて表を自動更新します。
    * **値が変化したセルは黄色くハイライト**されるため、アルゴリズムの挙動確認に最適です。

* **🛡️ 安全設計:**
    * 特にC++などのポインタ操作において、範囲外アクセスによるゴミデータの表示やクラッシュを防ぐ厳密なサイズチェック機能を搭載しています。

## 🚀 使い方

1.  デバッグセッションを開始し、ブレークポイントで停止させます。
2.  以下のいずれかの方法でビューアを起動します：
    * **変数ビューから:** 「変数 (Variables)」ビューで変数を右クリックし、**"View as Matrix (2D Table)"** を選択。
    * **コマンドパレットから:** (`Ctrl+Shift+P`) から `Matrix Viewer: View as Matrix` を実行し、変数名を入力（例: `grid`, `dp`）。

## 📅 Release Notes

### 1.0.0
* Renamed to **Matrix Viewer**.
* Added support for Python, Rust, JS, C#.
* **Enhanced jagged array support:** Fixed issues with varying row lengths and rendering glitches.
* **Performance:** Implemented row size caching and stricter boundary checks.
* **Object Preview:** Added ability to peek into object properties within cells.

---

**Enjoy debugging!**