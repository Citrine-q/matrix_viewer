# Matrix Viewer
日本語は下にあります。

**Matrix Viewer** is a powerful visualization tool for VS Code that allows you to view 2D arrays, matrices, and vectors as a **Grid / Spreadsheet** during debugging.

It supports multiple languages including **C++, Python, Rust, JavaScript/TypeScript, C#**, and more. It helps you understand complex data structures at a glance, replacing the tedious tree-view inspection.



## ✨ Features

* **⚡ Lazy Loading (Big Data Support):**
    * Smartly fetches only the rows and columns currently visible.
    * Handles massive datasets (e.g., 10,000 x 10,000) without freezing the UI.
* **🌐 Multi-Language Support:**
    * Works with **C++** (`std::vector`, arrays), **Python** (list of lists), **Rust** (`Vec<Vec<T>>`), **JavaScript**, **C#**, and more.
    * Adaptive Size Detection: Automatically attempts multiple size-retrieval strategies (`.size()`, `len()`, `.length`, etc.) to find the one that works for the current debug session.
* **🔄 Live Update & Diff Highlighting:**
    * Automatically refreshes the table when you step through code (Step Over/Into).
    * **Highlights changed cells** in yellow, making it easy to track algorithm progress.
* **👀 Split View:**
    * Opens in a side panel automatically, so you can see your code and data side-by-side.

## 🚀 Usage

1.  Start a debugging session and hit a breakpoint.
2.  Open the viewer using one of these methods:
    * **Context Menu:** Right-click a variable in the "Variables" view and select **"View as Matrix (2D Table)"**.
    * **Command Palette:** Run `Matrix Viewer: View as Matrix` and enter the variable name (e.g., `grid`, `matrix[0]`).

## 🛠 Supported Languages

This extension attempts to evaluate array sizes using various strategies, making it compatible with:

* **C / C++** (`std::vector`, raw arrays)
* **Python** (Lists, generic iterables)
* **Rust** (`Vec`, arrays)
* **JavaScript / TypeScript** (Arrays)
* **C#** (List, Arrays)
* **Java** (Arrays, Lists)
* *And any language where array size can be accessed via `.size()`, `len()`, or `.length`.*

## 📸 Demo

## ⚠️ Known Limits

* **3D+ Arrays:** Currently supports up to 2 dimensions. 3D arrays may cause errors or display incorrectly.
* **Object Display:** Cells display the string representation of values. Complex objects might show as `[Object object]` or memory addresses unless they have a clear string representation.

---
# Matrix Viewer (Japanese)

**Matrix Viewer** は、VS Codeでのデバッグ中に、2次元配列や行列（Matrix）、VectorなどをExcelのような**「2次元の表（グリッド）」**形式で可視化する拡張機能です。

**C++, Python, Rust, JavaScript, C#** など、多くのプログラミング言語に対応しています。標準の「変数ビュー」ではツリー構造で確認しづらい行列データも、このツールを使えば一目で全体像を把握できます。

## ✨ 主な機能

* **⚡ 高速な描画 (Lazy Loading):**
    * 必要な行・列だけを読み込む「遅延読み込み」を採用。
    * **10,000行 x 10,000列** のような巨大なデータでも、フリーズすることなく瞬時に開けます。
* **🌐 多言語対応:**
    * **C++** (`std::vector`, 配列), **Python** (リストのリスト), **Rust** (`Vec<Vec<T>>`), **JavaScript**, **C#** などに対応。
    * サイズ取得の自動化: 配列サイズの取得コマンド (`.size()`, `len()`, `.length` 等) を自動的に試行・特定するため、言語ごとの設定不要で動作します。
* **🔄 自動更新 & 差分ハイライト:**
    * デバッガでステップ実行（Step Over/Into）を行うと、表の内容が自動的にリフレッシュされます。
    * **値が変化したセルは黄色くハイライト**されるため、アルゴリズムの挙動確認に最適です。
* **👀 2画面分割:**
    * コードエディタを隠さないよう、自動的に隣のパネル（Split View）で開きます。

## 🚀 使い方

1. デバッグセッションを開始し、ブレークポイントで停止させます。
2. 以下のいずれかの方法でビューアを起動します：
    * **変数ビューから:** 「変数 (Variables)」ビューで変数を右クリックし、**"View as Matrix (2D Table)"** を選択。
    * **コマンドパレットから:** (`Ctrl+Shift+P`) から `Matrix Viewer: View as Matrix` を実行し、変数名を入力（例: `grid`, `matrix[0]`）。

## 🛠 対応言語・環境

この拡張機能は、複数のサイズ取得戦略を総当りで試行するため、以下の言語を含む多くの環境で動作します。

* **C / C++** (`std::vector`, 生配列)
* **Python** (リスト, イテラブル)
* **Rust** (`Vec`, 配列)
* **JavaScript / TypeScript** (配列)
* **C#** (List, 配列)
* **Java** (List, 配列)
* *その他、`.size()`, `len()`, `.length` 等でサイズが取得可能な言語*

## ⚠️ 既知の制限

* **3次元以上の配列:** 現在のバージョンでは2次元までの表示に対応しています。3次元以上の配列は正しく表示されない、またはエラーになる可能性があります。
* **オブジェクトの表示:** セルには値の文字列表現が表示されます。複雑なオブジェクトは、適切な文字列変換（ToString等）が定義されていない場合、`[Object object]` やメモリアドレスとして表示されることがあります。

## 📅 リリースノート (Release Notes)

### 1.0.0
* Initial release (Matrix Viewerとして公開)
* Python, Rust, JS, C# などの多言語対応を追加
* Rust (`Vec`) のサイズ検出ロジックを強化
* 巨大データに対応する遅延読み込み機能
* ステップ実行時の自動更新と差分ハイライト機能

---

**Enjoy debugging!**