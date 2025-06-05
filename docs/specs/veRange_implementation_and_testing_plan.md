# VeRange 實作與萬人投票壓力測試計畫

## 總覽

本文件詳細規劃了 VeRange Type-1 功能的實作步驟，並整合了大規模壓力測試方案，旨在全面評估區塊鏈投票系統在整合 VeRange 後的效能、安全性與可靠性。計畫分為功能實作、本地高速模擬測試、以及 Testnet 併發壓力測試三個主要階段。

---

## 第一階段：功能實作與單元/整合測試

此階段的目標是完成 VeRange Type-1 的核心功能，並確保其在單次操作下的正確性。

### 里程碑 1：導入核心密碼元件
*   **任務：**
    *   在前端專案中導入 `@verange/sdk` 套件。
    *   將 `VerangeVerifier.sol` 檔案放置到智慧合約專案的 `contracts/lib/` 目錄下。
*   **目標：** 能夠在本地環境成功產生 VeRange 證明 (π)，並透過 `VerangeVerifier.sol` 在本地進行驗證。

### 里程碑 2：改造智慧合約 (`CountingContract`)
*   **任務：**
    *   依照 VeRange 規格修改現有的 `CountingContract.sol`，使其：
        *   繼承 `VerangeVerifier`。
        *   調整 `submitBallot` 函數以接收 `proof` (VeRange π) 和 `commitment` (Pedersen commit of v)。
        *   在 `submitBallot` 中調用 `verifyVeRange` 進行驗證。
        *   確保 `BallotMeta` 結構和 `ballots` 映射的正確性。
        *   正確觸發 `BallotAccepted` 事件。
    *   撰寫 Hardhat 測試案例，涵蓋：
        *   **Happy Path：** 成功註冊、產生有效證明、成功調用 `submitBallot()`。
        *   **非法證明：** 提交一個被竄改過的證明，預期交易會因 `INVALID_RANGE` 而 revert。
        *   **重複投票：** 同一身份嘗試提交第二次投票，預期交易會 revert。
    *   產生 Gas 使用報告，特別關注 `verifyVeRange` 的 Gas 消耗。
*   **目標：** 所有 Hardhat 測試案例通過，並產出單票 `verifyVeRange` 的 Gas 消耗報告。

### 里程碑 3：前端 WebWorker 整合與投票流程串接
*   **任務：**
    *   實作 `ProofWorker.ts`：
        *   接收來自主要執行緒的票值 `value` 和隨機數 `rand`。
        *   使用 `@verange/sdk` 的 `prove` 函數產生 VeRange 證明 π。
        *   將產生的證明 π 回傳給主要執行緒。
    *   修改 `VotingPage.tsx`：
        *   在使用者選擇票值後，調用 `ProofWorker.ts` 以非同步方式產生證明。
        *   (建議) 在 UI 上顯示證明生成進度。
        *   將加密後的選票 (`encryptedBallot`) 上傳至 IPFS，獲取 CID。
        *   調用 `CountingContract` 的 `submitBallot` 函數，傳入 CID、VeRange 證明 (π) 和票值的 Pedersen commitment。
        *   等待交易完成，並提示使用者投票結果。
*   **目標：** 使用者可以透過前端介面完成投票，選票資訊（CID）和 VeRange 證明成功提交至區塊鏈，並且可以在區塊鏈瀏覽器上觀察到 `BallotAccepted` 事件。

---

## 第二階段：大規模壓力測試與效能分析

此階段旨在模擬大量用戶同時投票的場景，評估系統的擴展性和在高負載下的表現。

### 路徑 A：本地高速模擬 (使用 Hardhat／Anvil)

適合大量重複呼叫合約函式、收集 Gas 統計，快速驗證功能與初步效能。

#### 里程碑 4A：建立本地測試環境與部署
*   **任務：**
    *   設定 Hardhat 或啟動 Anvil，使其支持大量帳戶 (例如 20,000 個) 和足夠的 ETH (例如每個帳戶 1 ETH)。調整 `blockGasLimit` 以容納多筆交易。
    *   編寫並執行 `scripts/deploy.js`，將 `CountingContract` 部署到本地測試網路。
*   **目標：** 本地測試鏈啟動，合約成功部署，並記錄下合約地址。

#### 里程碑 5A：模擬大量投票者與證明生成 (單票)
*   **任務：**
    *   編寫 `scripts/genVoters.js` (或類似腳本)：
        *   建立大量測試錢包 (例如 10,000 個)。
        *   (可選) 為這些錢包批次空投少量 ETH 以支付 Gas。
        *   使用 `p-limit` 或類似機制控制併發，模擬大量投票者提交交易。
        *   每個模擬投票者：
            *   產生虛擬票值 `v`。
            *   使用 `@verange/sdk` 的 `prove` 函數產生 VeRange 證明 π 和 commitment。
            *   產生一個模擬的 IPFS CID。
            *   調用 `CountingContract.submitBallot()` 提交選票。
    *   (建議) 使用 Node.js `worker_threads` 平行化 VeRange 證明的生成，以加速腳本執行。
*   **目標：** 成功模擬指定數量 (例如 10,000) 的獨立投票提交到本地鏈，所有交易成功被挖掘。

#### 里程碑 6A：收集 Gas 數據與效能分析 (單票)
*   **任務：**
    *   整合 `hardhat-gas-reporter` 或編寫腳本監聽 `provider.on("block", ...)` 來收集每個區塊的 `gasUsed`。
    *   執行壓力測試腳本後，統計總 Gas 消耗、平均每筆交易 Gas 消耗。
    *   分析本地鏈在模擬大量交易時的 TPS、區塊打包速度等。
*   **目標：** 產出包含總 Gas、平均 Gas、交易成功率等關鍵指標的報表。例如："10,000 票提交成功，總 Gas ≈ X B，平均 Y k"。

### 路徑 B：Testnet 併發壓力測試（Goerli / Sepolia，並引入聚合證明)

更接近真實網路環境，驗證系統在實際限制下的表現，特別是 TPS 和 Gas 成本。

#### 里程碑 4B：實作聚合證明功能 (若適用)
*   **任務：**
    *   (若計畫支援) 修改智慧合約以支援聚合證明的驗證函數，例如 `verifyAggregateRangeProof()`。
    *   在 `@verange/sdk` (或您的輔助庫中) 實現離鏈聚合證明 `aggregateProof([...])` 的邏輯。
*   **目標：** 能夠在離鏈生成聚合證明，並在鏈上透過新函數驗證。

#### 里程碑 5B：準備 Testnet 測試環境與帳戶
*   **任務：**
    *   獲取足夠的 Testnet ETH 到一個或多個資金帳戶。
    *   準備用於提交交易的帳戶私鑰 (可以少量，因為可以批次提交聚合證明)。
*   **目標：** 測試所需資金和帳戶準備就緒。

#### 里程碑 6B：Testnet 併發提交與監控 (使用聚合證明)
*   **任務：**
    *   編寫腳本：
        *   將大量選票數據分批 (例如每批 100 張票)。
        *   對每一批次，離鏈生成聚合 VeRange 證明。
        *   使用 `Bottleneck` 或類似工具，以受控的速率 (例如每 300ms 一筆) 向 Testnet 提交聚合證明的驗證交易。
    *   部署合約到 Testnet (Goerli/Sepolia)。
    *   執行腳本，監控交易狀態。
    *   使用 `eth_getLogs` 或 Etherscan/Infura/Alchemy 等服務追蹤 `BallotAccepted` (或聚合版本) 事件的數量。
    *   記錄任何交易失敗 (如 `INVALID_RANGE`, `Duplicate vote`) 的情況和比例。
    *   (可選) 設置 Grafana + Prometheus 監控 Testnet 節點的 TPS、pending transactions 等指標。
*   **目標：** 在 Testnet 環境下成功提交大量選票 (透過聚合證明)，並收集實際的交易時間、Gas 費用、成功率等數據。

---

## 第三階段：分析、優化與報告

此階段對測試結果進行全面分析，識別瓶頸，並提出優化建議。

### 里程碑 7：結果分析與潛在優化
*   **任務：**
    *   分析本地模擬和 Testnet 測試的數據，比較兩者差異。
    *   識別效能瓶頸 (例如：證明生成速度、RPC 請求限制、Gas 上限、合約執行效率)。
    *   根據測試結果，考慮是否需要實施如 L2 遷移、更積極的證明聚合策略、合約邏輯優化等方案。
*   **目標：** 對系統效能有深入理解，並確定潛在的優化方向，形成最終的效能評估報告。

---

## 一般性考量 (貫穿所有階段)

*   **私鑰管理：** 測試帳戶的私鑰可以存儲在 `.json` 文件中供腳本導入，或使用本地開發鏈 (Anvil/Hardhat) 提供的預設帳戶。**切勿將真實私鑰硬編碼或提交到版本控制系統。**
*   **RPC 節點：** 對於 Testnet 大量請求，需注意 RPC 節點的速率限制。免費方案可能不夠，考慮自架節點 (如 Erigon/Nethermind) 或使用付費 RPC 服務。
*   **CI/CD 整合：** 考慮將部分壓力測試 (例如小規模本地模擬 `scripts/genVoters.js --quick 500`) 整合到 CI (如 GitHub Actions) 流程中，實現自動化回歸測試，確保每次程式碼變更不會導致效能退化。
*   **資金管理：** 在 Testnet 進行大規模測試前，確保有足夠的測試幣，並規劃好資金分配。
*   **版本控制：** 所有腳本、合約修改、配置文件都應納入版本控制。

---

本計畫提供了一個從基礎功能實現到大規模壓力測試的完整框架，旨在系統性地推進 VeRange 的整合與驗證工作。 