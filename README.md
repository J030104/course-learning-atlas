# Course Learning Atlas

靜態課程學習圖鑑。共用介面在 `src/`，每門課的主題、樣式與教材由獨立的 `course.json` 管理。教材和作業分區，PDF 與已轉檔的 PPTX 可以上下捲動，Esc 關閉目前的預覽。

單門課可以獨立建站。多門課也可共用網站，由頁首切換。收藏與閱讀位置儲存在各自的瀏覽器，並按課程與檔案格式分開。

## 本機試用

需要 Python 3.10 或更新版本。從專案根目錄執行：

```sh
python3 atlas.py build
python3 -m http.server 8759 --bind 127.0.0.1 --directory dist
```

瀏覽 `http://127.0.0.1:8759`。執行 `python3 atlas.py build --site examples/site.json` 可以改看兩門課的示範站。

## 已有教材

1. 建立一份新設定，例如下方的 `init` 命令。
2. 在 `course.json` 的 `topics` 和 `resources` 列出要收錄的主題與檔案，參考 [行動網路示例](examples/networking/course.json)。
3. 用 `--materials /path/to/existing-materials` 指向教材根目錄。檔案相對於該目錄。HTML 的圖片、CSS 或資料檔要列在 `assets`。
4. 執行 `python3 atlas.py build --config private/my-course/course.json --materials /path/to/existing-materials`。

## 從空白課程開始

```sh
python3 atlas.py init private/my-course --id my-course --code MY101 --title "我的學習課程"
python3 atlas.py build --config private/my-course/course.json
```

將教材放在設定旁的 `materials/`，再加入資源清單。預設只複製明列的檔案。`private/` 和 `dist/` 已排除於 Git。發佈前仍須檢查打包內容，確保教材適合目標讀者的存取範圍。

## 單課或合併建站

使用 `--config` 可獨立建一門課。使用 `--site` 可讓多門課共用網站，頁面上的下拉選單會切換課程。站點設定可為每門課指定教材根目錄，參考 [合併設定](examples/site.json)。保留課程 ID，既有課程路徑與瀏覽器紀錄才能延續。

`course.json` 可調整課程標題、分區名稱、主題、類型與主色。每項資源可以設定 `area`、`keywords`、`thumbnail`、`synthetic` 和 `historical`。有權使用的 PPTX 可用 `--convert-pptx` 透過 LibreOffice 匯出，或指定 `{"path":"slides.pptx","preview":"slides-preview.pdf"}`。建置不執行 Notebook。

## 驗證

```sh
python3 -m unittest discover -s tests -v
```

測試涵蓋空白與已有課程、課程版本隔離、同站多課改版、同一輸出目錄的單寫入保護，以及建置失敗時保留上一版。


## 新版提醒與發布

每個課程輸出 `version.json`。它分別追蹤課程內容、共用程式、課程清單。頁面載入時記住自己的版本，之後在切回頁面及每分鐘檢查。只有其他課程的內容變動時，正在閱讀的課程不會顯示提示。提示可在預覽中看到，由讀者自行重新整理。閱讀器在開啟文件時使用單一下載串流。

- **CI** 會在提交與 PR 檢查 Python 建置、單課／多課輸出、兩個獨立讀者的行為和 PDF 重新整理。
- **公開發布** 可在 GitHub Pages 設定將來源選為 GitHub Actions，從預設分支手動執行「Publish public Atlas」。預設發布自製雙課示例。發布其他課程時指定已提交且允許公開的 manifest。
- **同時更新多課** 時，先把兩課的變更合併至預設分支，再由同一工作流發布。工作流一次只部署一份完整快照，排隊中的發布會在取得執行權後讀取最新的預設分支。
- **回復** 時，在預設分支以新提交回復有問題的變更，再執行同一工作流。已開啟的頁面會以同樣方式收到版本提示。
- **私人內容** 請留在私人來源與有存取控制的部署目的地。公開工作流使用可公開的教材，瀏覽器本機的收藏機制不提供網站存取控制。

## 執行瀏覽器測試

```sh
npm ci
npx playwright install chromium
npm test
```

測試用兩個獨立瀏覽器環境同時開啟講義，核對收藏、閱讀位置、課程更新隔離、同站雙課更新及重新整理。若已有 Chromium 或 Edge，可設 `ATLAS_BROWSER` 指向可執行檔再執行測試。
