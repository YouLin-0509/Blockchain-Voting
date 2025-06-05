以下是我對於專案系統的實做方式和後續想法:


**系統設計描述與後續計畫**

接下來，我將詳細描述這個基於 Router-Plugin 架構的投票系統設計，並根據 `blueprint_four_systems.md` 提出後續系統的實作計畫。

**系統設計描述：Router-Plugin 投票系統 (v1.0.0-router-plugin)**

**1. 核心架構與選擇理由：**

本系統採用了「Router-Plugin」設計模式。選擇此模式的核心理由是為了實現高度的**模組化**和**可擴展性**。在區塊鏈投票應用中，計票邏輯 (Tally) 和潛在的驗證機制 (Verifier) 可能會根據不同的投票需求而變化。Router-Plugin 模式允許我們將核心的投票流程管理 (Router) 與具體的業務邏輯 (Plugins) 分離開來。

*   **Router (`VotingRouter.sol`)**：作為系統的中樞，負責處理與用戶直接相關的通用操作，如投票階段管理、選民註冊、候選人管理、管理員權限控制，以及作為連接不同插件的橋樑。它不直接實現具体的計票或驗證細節，而是通過標準化介面調用外部插件合約。
*   **Plugins (`ITally.sol`, `IVerifier.sol`)**：代表可插拔的業務邏輯模組。
    *   `ITally`: 定義了計票插件必須實現的功能，如記錄投票 (`tallyVote`) 和獲取結果 (`getResults`, `getCandidateCount`)。
    *   `IVerifier`: 定義了驗證插件的介面，主要用於驗證投票的合法性，例如通過零知識證明 (`verify`)。

這種分離使得未來可以輕鬆替換或增加新的計票算法或驗證方法，而無需修改核心的 `VotingRouter` 合約，大大提高了系統的靈活性和可維護性。

**2. 關鍵合約詳解：**

*   **`VotingRouter.sol`**:
    *   **角色**：系統的總控制器和用戶主要交互介面。
    *   **功能**：
        *   管理員 (`admin`)：擁有配置系統、管理插件和投票週期的特殊權限。可轉移。
        *   投票階段 (`VotingPhase`)：通過 `REGISTRATION`, `VOTING`, `FINISHED` 三個階段嚴格控制投票流程。
        *   插件集成：在建構時或由管理員後續設定 `tallyPlugin` 和 `verifierPlugin` 的地址。`tallyPlugin` 是必需的，`verifierPlugin` 是可選的 (允許零地址)。
        *   候選人管理 (`candidates`)：在建構時初始化，並提供查詢接口。
        *   選民註冊 (`registeredVoters`, `isRegistered`)：允許用戶自行註冊，或由管理員代為註冊。
        *   投票記錄 (`voted`)：防止重複投票。
        *   核心投票函數 (`vote`)：此函數會先進行一系列檢查 (階段、註冊狀態、是否已投票)，如果配置了 `verifierPlugin`，則調用其 `verify` 方法；然後調用 `tallyPlugin` 的 `tallyVote` 方法記錄選票。
    *   **事件**：定義了如 `VoterRegistered`, `VoteCast`, `PhaseChanged` 等重要事件，方便鏈下監控和前端反饋。

*   **`ITally.sol` / `TallyBase.sol`**:
    *   `ITally.sol`：定義了計票插件的標準介面。
        *   `tallyVote(address voter, uint256 candidateId) external`: 外部調用，用於記錄一票。`VotingRouter` 會傳遞投票者地址和候選人 ID。
        *   `getResults() external view returns (uint256[] memory)`: 返回各候選人的得票數數組。
        *   `getCandidateCount() external view returns (uint256)`: 返回候選人數量，方便結果數組的解析。
    *   `TallyBase.sol`：是 `ITally.sol` 的一個基礎實現。
        *   **建構函式**：接收候選人姓名列表，並初始化內部計票結構。
        *   **計票邏輯**：內部維護一個 `mapping(uint256 => uint256) private _voteCounts` 來存儲每個候選人的票數，以及 `mapping(address => bool) private _hasVotedInternal` 來配合 `VotingRouter` 的檢查 (雖然 `VotingRouter` 也有自己的 `voted` mapping，但插件內部也可能有獨立的檢查需求，或被設計為可獨立使用)。
        *   `tallyVote` 實現了對 `_hasVotedInternal` 的檢查，更新票數，並觸發 `VoteCastInTally` 事件。

*   **`IVerifier.sol`**:
    *   `verify(bytes calldata proof, bytes calldata publicInputs) external view returns (bool)`: 定義了驗證函數的標準簽名。設計上是通用的，可以適應不同的驗證方案，例如零知識證明的 `proof` 和 `publicInputs`。在當前的基礎系統中，此插件是可選的，並未強制實現和使用。

*   **`Errors.sol`**:
    *   將所有自定義錯誤（如 `VotingRouter__NotAdmin`, `VotingRouter__InvalidPhase`, `TallyBase__AlreadyVoted` 等）集中在一個文件中管理。
    *   **優點**：
        *   **節省 Gas**：相比 `require` 使用字串描述錯誤，自定義錯誤更節省 Gas。
        *   **清晰性**：錯誤定義集中，方便查閱和維護。
        *   **標準化**：整個項目使用統一的錯誤代碼風格。

**3. 主要流程：**

*   **部署流程 (`scripts/deploy-router.js`)**：
    1.  定義候選人列表。
    2.  部署 `TallyBase` 合約，傳入候選人列表。
    3.  部署 `VotingRouter` 合約，傳入候選人列表、已部署的 `TallyBase` 合約地址，以及一個零地址作為 `verifierPlugin` (因為目前沒有實現)。
*   **管理員操作流程**：
    1.  **設置階段**：調用 `startVotingPeriod()` 將階段從 `REGISTRATION` 切換到 `VOTING`；調用 `endVotingPeriod()` 將階段從 `VOTING` 切換到 `FINISHED`。
    2.  **管理插件**：可以調用 `setTallyPlugin()` 或 `setVerifierPlugin()` 更新插件地址。
    3.  **管理員註冊選民**：調用 `registerVoterByAdmin(address voter)` 為指定地址註冊。
    4.  **轉移管理權限**：調用 `setAdmin(address newAdmin)` 將管理權限轉移給新地址。
*   **普通用戶操作流程**：
    1.  **註冊 (`register`)**：在 `REGISTRATION` 階段，用戶調用 `register()` 進行自我註冊。
    2.  **投票 (`vote`)**：在 `VOTING` 階段，已註冊且未投票的用戶調用 `vote(uint256 candidateId, bytes calldata proof, bytes calldata publicInputs)` 進行投票。`proof` 和 `publicInputs` 目前在基礎系統中未使用，可以傳遞空字節。
*   **結果查詢流程**：
    *   任何人都可以調用 `VotingRouter` 的 `getCandidates()` 獲取候選人列表。
    *   在 `FINISHED` 階段後，任何人都可以調用 `VotingRouter` 的 `getResults()` (該函數內部會調用 `tallyPlugin.getResults()`) 來獲取各候選人的最終票數。

**4. 前端交互 (`frontend/`)**：

*   **配置 (`src/config/`)**：
    *   `contracts.js`：導出 `VOTING_ROUTER_ADDRESS` (從 `.env` 讀取) 和 `VOTING_ROUTER_ABI`, `TALLY_BASE_ABI` (從複製的 JSON 文件讀取)。
*   **Hooks (`src/hooks/`)**：
    *   使用 `wagmi` 提供的 Hooks (`useContractRead`, `useContractWrite`, `usePrepareContractWrite`) 與 `VotingRouter` 合約進行交互。
    *   例如 `useResults.js` 調用 `getResults`，`usePhase.js` 調用 `getPhase`，`useVote.js` 準備和執行 `vote` 交易。
*   **組件 (`src/components/`)**：
    *   `AdminPanel.jsx`：提供管理員操作界面，如階段控制、插件地址顯示/設置、選民註冊、結果展示等。
    *   `Registration.jsx`：處理用戶註冊邏輯。
    *   `Voting.jsx`：顯示候選人列表，處理用戶投票邏輯。
    *   所有組件都依賴 `VOTING_ROUTER_ADDRESS` 和 `VOTING_ROUTER_ABI` 與合約交互，並根據合約狀態（階段、註冊情況、投票情況）渲染不同的 UI 和錯誤/成功訊息。

**5. 可擴展性與未來展望：**

*   **計票插件的多樣性**：可以輕鬆實現並替換 `ITally` 的不同實現。例如：
    *   加權投票計票插件。
    *   二次方投票計票插件。
    *   具有更複雜投票結果計算邏輯的插件。
*   **驗證插件的引入**：當需要引入更高級的隱私保護或防共謀機制時，可以實現 `IVerifier` 插件。例如：
    *   基於零知識證明的匿名投票驗證插件 (如 Semaphore, MACI)。
    *   其他類型的投票資格或投票權重驗證插件。
*   **Router 功能的穩定性**：`VotingRouter` 的核心邏輯（階段管理、基礎的選民和候選人管理）相對穩定，新功能的增加主要通過插件實現。

---

**後續系統實作計畫 (參考 `technical_blueprint.md`)**

根據 `technical_blueprint.md` 的指導，後續系統的開發將專注於整合安全多方計算 (MPC) 和 VeRange 零知識範圍證明技術，以增強投票系統的隱私性、安全性和可驗證性。所有新系統的開發都應基於當前的 `v1.0.0-router-plugin` 版本，並為每個主要功能集創建獨立的特性分支。

**通用準備：**

*   **分支策略**：
    *   `feat/mpc-voting`：用於整合 MPC 的系統。
    *   `feat/verange-voting`：用於整合 VeRange 的系統。
    *   `feat/mpc-verange-voting`：用於整合 MPC 和 VeRange 的系統。
    *   所有新分支均從最新的 `main` (即 `v1.0.0-router-plugin`) 分支出來。
*   **文檔更新**：在開始每個系統的開發前，詳細規劃其特定需求，並更新相關的規格文檔/本文件。
*   **合約交互**：考慮 `technical_blueprint.md` 中的 `ManagementContract (SCm)` 和 `CountingContract (SCt)` 的概念如何融入或影響 `VotingRouter` 及插件的設計。`VotingRouter` 可能會承擔部分 `SCm` 的職責，而 `ITally` 和 `IVerifier` 插件可能需要與類似 `SCt` 的邏輯交互或自身實現其部分功能。

**系統二：整合 MPC 的投票系統 (基於 Router-Plugin)**

*   **核心目標**：實現票值隱私（選票內容對除計票機制外各方保密）和安全計票（通過多方計算聚合結果，防止單點故障或舞弊），主要依賴鏈下 MPC 節點網絡進行 Shamir 秘密共享和計算。
*   **`VotingRouter.sol` 調整/配置**：
    *   `vote(uint256 candidateId, bytes calldata proof, bytes calldata publicInputs)`：在此系統中，`candidateId` 可能不再直接是明文候選人 ID。用戶投票的實際內容（例如，加密後的選票或指向 IPFS 的選票 CID）需要一種方式被記錄和傳遞給 MPC 網絡。`proof` 和 `publicInputs` 在此階段可能尚未使用。
    *   `VotingRouter` 可能需要記錄加密選票的引用（如 IPFS CID），並在投票結束後觸發 MPC 流程（類似 `technical_blueprint.md` 中的 `dispatchMPC`）。
    *   事件：可能需要新的事件來標記選票已提交待 MPC 處理，以及 MPC 計票完成。
*   **`ITally` 插件實現 (`MPCTally.sol`)**：
    *   `tallyVote(address voter, ...)`：此函數的參數和邏輯將有較大變化。它可能不再直接累計票數，而是記錄選票的元數據，或者接收 MPC 網絡處理後的中間加密數據。
    *   `getResults()`：此函數將負責從 MPC 網絡的最終輸出（可能是經過閾值加密並提交到鏈上某處，或由 `MPCTally` 自身存儲的 MPC 結果）中檢索和解密（如果需要）投票結果。這可能需要一個由管理員或其他授權方觸發的函數來寫入 MPC 計算的最終結果。
    *   可能需要與鏈下 MPC 節點協調，接收它們計算並經過閾值簽名的結果。
*   **`IVerifier` 插件**：此階段主要關注 MPC，`IVerifier` 可以是可選的，或者是一個基礎的實現，不涉及複雜的證明驗證。
*   **鏈下組件 (MPC 網絡)**：
    *   實現 `technical_blueprint.md` 中描述的 MPC 節點功能：
        *   從 IPFS（或其他來源）獲取加密選票。
        *   執行 Shamir 秘密共享。
        *   安全聚合 (Secure Aggregate Σ)。
        *   安全排序 (Secure Sort，如果需要)。
        *   閾值加密最終結果並提交到鏈上（例如，調用 `MPCTally` 的特定函數）。
*   **前端交互 (`frontend/`)**：
    *   用戶投票時，選票需要在前端進行加密（例如，使用 ElGamal 加密，公鑰可能是全局的或與特定選舉相關的），然後上傳到 IPFS。
    *   將 IPFS CID（或其他選票引用）提交給 `VotingRouter` 的 `vote` 函數。
    *   結果展示需要能處理從 `MPCTally` 獲取的（可能需要解密的）結果。
*   **測試策略**：
    *   單元測試 `MPCTally.sol` 與 MPC 結果的交互邏輯。
    *   模擬 MPC 節點的行為，測試其與智能合約的集成。
    *   端到端測試：用戶投票 -> 前端加密上傳 -> `VotingRouter` 記錄 -> 模擬 MPC 處理 -> `MPCTally` 更新結果 -> 前端展示。

**系統三：整合 VeRange 的投票系統 (基於 Router-Plugin)**

*   **核心目標**：確保選票值的合法性（例如，選民投票的候選人索引在有效範圍內，或投票權重不超限），而不一定提供強票值隱私。計票邏輯可以類似於基礎版本的 `TallyBase`。
*   **`VotingRouter.sol` 調整/配置**：
    *   `vote(uint256 candidateId, bytes calldata proof, bytes calldata publicInputs)`：此函數將被充分利用。
        *   `candidateId`：代表用戶選擇的候選人。
        *   `proof`：用戶為其選票 `candidateId` 生成的 VeRange 證明。
        *   `publicInputs`：VeRange 證明的公共輸入，應包含 `candidateId` 或其承諾，以及範圍參數。
    *   在調用 `tallyPlugin.tallyVote` 之前，必須先調用 `verifierPlugin.verify(proof, publicInputs)`。
*   **`ITally` 插件 (可沿用 `TallyBase.sol` 或其變體 `VeRangeAwareTally.sol`)**：
    *   `tallyVote(address voter, uint256 candidateId)`：與基礎版類似，但在 `VotingRouter` 中確保只有通過 VeRange 驗證的投票才會調用此函數。
    *   `getResults()` 和 `getCandidateCount()` 保持不變。
*   **`IVerifier` 插件實現 (`VeRangeVerifier.sol`)**：
    *   實現 `verify(bytes calldata proof, bytes calldata publicInputs) external view returns (bool)`。
    *   內部調用 `technical_blueprint.md` 中提及的 VeRange 官方 Solidity 庫或預編譯合約來驗證證明。
    *   需要確保 `publicInputs` 的結構與 VeRange 庫期望的一致，並能正確關聯到 `candidateId`。
*   **鏈下組件**：此系統主要依賴鏈上驗證，鏈下主要是前端的證明生成。
*   **前端交互 (`frontend/`)**：
    *   用戶選擇候選人後，前端需要使用 VeRange 的 JS/TS SDK 為選票值（`candidateId`）生成零知識範圍證明。
    *   將 `candidateId`、生成的 `proof` 和 `publicInputs` 傳遞給 `VotingRouter` 的 `vote` 函數。
    *   錯誤處理：處理 VeRange 證明生成失敗或鏈上驗證失敗的情況。
*   **測試策略**：
    *   單元測試 `VeRangeVerifier.sol` 的驗證邏輯，包括有效和無效證明的場景。
    *   集成測試 `VotingRouter` 與 `VeRangeVerifier.sol` 和 `TallyPlugin` 的交互，確保只有有效票被計入。
    *   前端測試證明生成邏輯。

**系統四：整合 MPC 與 VeRange 的投票系統 (基於 Router-Plugin)**

*   **核心目標**：結合系統二的票值隱私和安全計票，以及系統三的票值合法性驗證。
*   **`VotingRouter.sol` 調整/配置**：
    *   `vote(..., bytes calldata proof, bytes calldata publicInputs)`：
        *   用戶提交的選票首先在前端加密並可能上傳到 IPFS，得到 CID。
        *   VeRange 證明 (`proof`, `publicInputs`) 用於證明原始選票內容（在加密前）的合法性。`publicInputs` 可能需要包含對應加密選票（例如其 CID 或其哈希）的承諾，以確保證明與將被 MPC 處理的數據相關聯。
        *   `VotingRouter` 首先調用 `verifierPlugin.verify()`。
        *   如果驗證成功，則記錄加密選票的引用 (CID) 以供後續 MPC 處理，類似系統二。
*   **`ITally` 插件實現 (`MPCWithVeRangeTally.sol` 或沿用 `MPCTally.sol`)**：
    *   與系統二中的 `MPCTally.sol` 類似，負責與 MPC 網絡交互並獲取/存儲最終結果。
    *   其處理的選票應是那些已經通過 `VeRangeVerifier` 驗證的。
*   **`IVerifier` 插件實現 (`VeRangeVerifier.sol`)**：
    *   與系統三中的 `VeRangeVerifier.sol` 相同，驗證前端生成的 VeRange 證明。
    *   `publicInputs` 的設計至關重要，需要能夠鏈接 VeRange 證明與將由 MPC 處理的加密選票。
*   **鏈下組件 (MPC 網絡 和 前端)**：
    *   **前端**：
        1.  用戶選擇候選人。
        2.  為原始選票內容生成 VeRange 證明。
        3.  將原始選票內容加密（例如 ElGamal），然後上傳到 IPFS 得到 CID。
        4.  將 (CID, VeRange 證明, 包含原始選票信息和/或 CID 承諾的公共輸入) 提交給 `VotingRouter`。
    *   **MPC 網絡**：
        *   與系統二類似，但只處理那些其 CID 已經通過 `VotingRouter` 中 VeRange 驗證並被記錄的選票。
*   **測試策略**：
    *   綜合系統二和系統三的測試策略。
    *   重點測試 `VotingRouter` 中 VeRange 驗證與 MPC 流程觸發之間的銜接。
    *   測試 `publicInputs` 在 VeRange 驗證和關聯加密選票方面的正確性。
    *   端到端測試覆蓋從前端生成證明和加密選票，到鏈上驗證，再到 MPC 處理和結果發布的全過程。

**實施順序和依賴考量：**

1.  **系統三 (VeRange 整合)**：可以首先實施，因為它對現有計票插件 (`TallyBase`) 的改動相對較小，主要增加 `IVerifier` 的實現和 `VotingRouter` 的驗證調用邏輯。這有助於團隊熟悉 ZKP 的前端集成和鏈上驗證。
2.  **系統二 (MPC 整合)**：接著可以實施 MPC 系統。這涉及更複雜的鏈下協調和對 `ITally` 插件的較大修改。
3.  **系統四 (MPC + VeRange 整合)**：最後，在前兩個系統的基礎上，整合兩者。此時，大部分核心組件（VeRange 驗證器、MPC 處理邏輯、部分前端修改）應已存在，重點在於將它們無縫集成。

這種逐步實施的方法有助於管理複雜性，並允許團隊在每個階段積累經驗。每個系統的開發都應伴隨著詳盡的測試，以確保其正確性、安全性和性能。
