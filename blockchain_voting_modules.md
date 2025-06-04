# 區塊鏈投票系統 AI 輔助開發模組分解

## Phase 1: 智慧合約 MVP (2-3 週) ⚡ **最高優先級**

### Module 1.1: 基礎合約框架
**目標**: 先實現可部署的合約骨架，驗證整體可行性
**AI 任務**:
```solidity
// 最小可行產品 - 先用簡化版本
contract VotingMVP {
    // 暫時用簡單的身份驗證替代 Ring Signature
    function registerVoter(address voter) external onlyOwner
    
    // 暫時跳過 VeRange，先實現基本投票
    function submitVote(uint256 candidateId) external
    
    // 基本的計票功能
    function getResults() external view returns (uint256[] memory)
}
```
**驗收標準**: 可在測試網部署並完成基本投票流程

---

### Module 1.2: 前端 DApp 基礎版
**目標**: 實現與合約交互的最簡 UI
**AI 任務**:
```typescript
// 基礎投票界面
const VotingApp = () => {
  const [candidates, setCandidates] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  
  const submitVote = async () => {
    // 調用合約 submitVote
  }
  
  const viewResults = async () => {
    // 調用合約 getResults
  }
}
```
**驗收標準**: 用戶可以通過 Web 界面完成投票並查看結果

---

## Phase 2: 密碼學組件整合 (3-4 週)

### Module 2.1: VeRange 整合 (優先)
**目標**: 將 VeRange 加入合約驗證
**AI 任務**:
```solidity
contract CountingContract {
    function submitEncryptedBallot(
        bytes32 cid, 
        bytes calldata veRangeProof
    ) external {
        require(verifyVeRange(veRangeProof), "Invalid proof");
        // 存儲投票
    }
}
```
**輸入給 AI**:
- VeRange 官方 Solidity library
- 具體的 gas 限制需求
- 錯誤處理機制

**驗收標準**: 合約能成功驗證 VeRange 證明，gas 消耗 < 500K

---

### Module 2.2: Ring Signature 簡化版
**目標**: 實現身份匿名化，但先用簡化版本
**AI 任務**:
```typescript
// 先實現基本的環簽名，不需要 linkable 特性
class SimpleRingSignature {
  generate(privateKey: string, publicKeyRing: string[], message: string): RingSigResult
  verify(signature: RingSigResult, publicKeyRing: string[], message: string): boolean
}
```
**驗收標準**: 能提供基本匿名性，暫不要求防重複投票

---

### Module 2.3: 前端密碼學整合
**目標**: 在前端生成 VeRange 證明和環簽名
**驗收標準**: 用戶可以生成有效證明並提交到合約

---

## Phase 3: MPC 系統 (4-5 週) - 可選延後

### Module 3.1: Shamir Secret Sharing
**目標**: 為 MPC 提供秘密分享
**風險評估**: 如果 Phase 1-2 已經證明系統可行，這部分可以作為進階功能

---

### Module 3.2: MPC 節點網路
**目標**: 實現離線計票
**風險評估**: 可以先用中心化計票驗證系統，MPC 作為後期優化

### Module 2.1: ManagementContract
**目標**: 選民註冊和 MPC 任務派發
**AI 任務**:
```solidity
contract ManagementContract {
    function register(bytes calldata ringSig, bytes32[] calldata pkRing) external
    function closeRegistration() external onlyOwner
    function dispatchMPC(uint256 voterCount, uint256 candidateCount) external
    function grantResultViewer(address candidate) external onlyOwner
}
```
**特殊要求**:
- Gas 優化
- 事件日誌設計
- 權限控制機制

---

### Module 2.2: CountingContract  
**目標**: 選票提交和 VeRange 驗證
**AI 任務**:
```solidity
contract CountingContract {
    function submitEncryptedBallot(bytes32 cid, bytes calldata veRangeProof) external
    function publishResult(bytes calldata encSum, bytes calldata encSorted, bytes[] calldata signatures) external
    function verifyVeRange(bytes calldata proof) internal pure returns (bool)
}
```
**特殊要求**:
- VeRange library 整合
- 重複投票防護
- 結果發布的多簽驗證
- **模組化與可配置性**: 合約應設計為可配置（例如通過 Owner 設定的布爾變數 `veRangeVerificationEnabled`），以允許在 `submitEncryptedBallot` 函數中選擇性地啟用或禁用 `verifyVeRange` 驗證。這對於支持「實驗情境1：僅採用 MPC」至關重要。或者，考慮為不同實驗情境維護不同的合約版本/分支，並透過部署腳本進行管理。

---

### Module 2.3: 合約測試套件
**AI 任務**: 生成全面的 Hardhat 測試
- 正常流程測試
- Edge case 測試
- Gas 消耗分析
- 安全攻擊模擬

---

## Phase 3: MPC 節點網路 (4-5 週)

### Module 3.1: MPC 節點核心
**目標**: 實作安全多方計算邏輯
**AI 任務**:
```rust
struct MPCNode {
    fn generate_shares(&self, ballots: Vec<EncryptedBallot>) -> Vec<Share>
    fn secure_aggregate(&self, shares: Vec<Share>) -> AggregateResult  
    fn secure_sort(&self, aggregate: AggregateResult) -> SortedResult
    fn encrypt_result(&self, result: SortedResult, candidate_pks: Vec<PublicKey>) -> EncryptedResult
}
```
**輸入給 AI**:
- Shamir 分享協議詳細說明
- 排序演算法的安全性需求
- ElGamal 加密參數

---

### Module 3.2: P2P 網路層
**目標**: 節點間安全通訊
**AI 任務**:
```rust
struct P2PNetwork {
    fn authenticate_peer(&self, peer_id: PeerId) -> bool
    fn broadcast_shares(&self, shares: Vec<Share>) -> Result<(), NetworkError>
    fn collect_shares(&self, timeout: Duration) -> Vec<Share>
}
```
**特殊要求**:
- libp2p 整合
- TLS 加密
- 節點故障處理

---

### Module 3.3: IPFS 整合
**AI 任務**: 
- 檔案上傳/下載封裝
- CID 驗證機制
- Pinning service 整合

---

## Phase 4: 前端 DApp (3-4 週)

### Module 4.1: 錢包連接組件
**AI 任務**:
```typescript
const WalletConnector = {
  connect: () => Promise<Account>,
  signMessage: (message: string) => Promise<Signature>,
  sendTransaction: (tx: Transaction) => Promise<TxHash>
}
```

---

### Module 4.2: 投票界面
**AI 任務**: React 組件開發
- 候選人列表
- 投票確認流程  
- VeRange 證明生成 (Web Worker) - **需可配置**: 前端邏輯需能根據當前測試情境，決定是否實際生成 VeRange 證明並將其發送到合約。
- 交易狀態追蹤

---

### Module 4.3: 結果驗證界面
**AI 任務**:
- 區塊鏈數據讀取
- VeRange 證明重新驗證
- MPC 結果重建展示

---

## Phase 5: 整合測試與優化 (2-3 週)

### Module 5.1: 端到端測試
**AI 任務**: 
- 完整投票流程自動化測試
- 多節點故障模擬
- 性能壓力測試

---

### Module 5.2: 安全審計
**AI 任務**:
- 智慧合約安全檢查
- 密碼學實作審計
- 網路攻擊模擬

---

## AI 協助策略建議

### 1. 提問模板
對每個模組使用標準化提問：
```
我需要實作 [模組名稱]，具體需求如下：
- 功能描述: [詳細說明]
- 輸入參數: [參數列表]  
- 輸出格式: [返回值說明]
- 性能要求: [Gas/速度限制]
- 安全考量: [安全需求]
請提供完整實作和測試案例。
```

### 2. 迭代改進流程
1. AI 提供初版實作
2. 人工審查和測試
3. 回饋修改需求給 AI
4. AI 優化和完善
5. 整合到主系統

### 3. 品質控制
- 每個模組都需要 AI 同時提供測試案例
- 要求 AI 解釋關鍵設計決策
- 人工審查所有密碼學相關程式碼

這樣的模組化設計讓你可以：
- 並行開發多個組件
- 單獨測試和驗證每個模組
- 降低系統複雜度
- 充分利用 AI 的程式碼生成能力

---

### 4. 版本控制與模組化實現策略
**目標**: 確保各模組能獨立開發與測試，並支持最終多情境的實驗驗證。
- **高度模組化**: 各組件（智能合約、前端、MPC）內部應實現高內聚、低耦合，便於獨立修改和替換。
- **智能合約版本/配置**:
    - **CountingContract**: 優先考慮通過合約內的可配置參數（如 `veRangeVerificationEnabled`，由擁有者在部署後設定）來控制 `verifyVeRange` 的執行。
    - 若合約邏輯差異較大，可考慮為不同實驗情境維護獨立的合約檔案（如 `CountingContract_MPCOnly.sol`, `CountingContract_VeRange.sol`），並使用清晰的 Git 分支策略（例如 `scenario/mpc-only`, `scenario/verange-only`, `scenario/combined`）管理。
- **前端適配**: 前端應用需能根據配置（例如環境變數或構建時的標誌）決定：
    - 是否調用 VeRange 證明生成邏輯。
    - 與哪個版本的合約或配置進行互動。
- **部署腳本**: 需為每個實驗情境準備或調整部署腳本，確保部署正確的合約版本並進行必要的初始化配置。
- **文檔記錄**: 詳細記錄各版本/配置的差異及其適用場景。

---

## Phase X: 系統表現實驗驗證 (X 週)

**目標**: 量化評估不同密碼學組件對系統關鍵指標的影響，包括 Gas 消耗、交易時間、證明生成時間等。

### Module X.1: 實驗環境搭建與基準測試工具
**目標**: 準備統一的測試環境和自動化腳本以收集和比較數據。
**任務**:
- **測試鏈選擇與配置**: 確定使用本地鏈 (如 Hardhat/Anvil) 或特定測試網。
- **數據收集腳本**: 開發腳本以自動化執行交易、記錄 Gas 消耗、交易確認時間、客戶端證明生成時間等。
- **基準指標定義**: 明確定義每個實驗情境下需要測量的關鍵性能指標 (KPIs)。

### Module X.2: 情境 1 - 僅採用 MPC (無鏈上 ZKP 驗證)
**目標**: 評估在沒有鏈上零知識證明驗證的情況下，單純使用 MPC 進行鏈下計票的系統表現。
**配置**:
- **ManagementContract**: 標準版，用於選民註冊和 MPC 任務派發。
- **CountingContract**: **MPC特化版/配置** (例如 `CountingContract` 部署時設置 `veRangeVerificationEnabled = false`，或部署 `CountingContract_MPCOnly.sol`)。其 `submitEncryptedBallot` 函數僅記錄選票 CID，不執行 `verifyVeRange`。
- **前端 DApp**: **MPC特化配置** (不生成 VeRange 證明，提交選票時 `veRangeProof` 參數可為空或預設值)。
- **MPC 系統**: 執行完整的秘密分享、安全聚合、安全排序。
**需測量指標**:
- 選民註冊 Gas 消耗。
- 選票提交 Gas 消耗 (此情境下應極低)。
- MPC 任務派發 Gas 消耗。
- MPC 執行時間 (各階段：分享、聚合、排序)。
- 結果發布 Gas 消耗 (如果結果需要上鏈)。

### Module X.3: 情境 2 - 僅採用 VeRange Type-1 (無 MPC 計票)
**目標**: 評估單獨使用 VeRange Type-1 進行鏈上選票有效性驗證的系統表現，假設計票過程簡化或中心化。
**配置**:
- **ManagementContract**: 標準版，用於選民註冊。
- **CountingContract**: **VeRange特化版/配置** (例如 `CountingContract` 部署時設置 `veRangeVerificationEnabled = true`，或部署 `CountingContract_VeRange.sol`)。其 `submitEncryptedBallot` 函數必須執行 `verifyVeRange`。計票邏輯簡化（例如，僅記錄加密選票供鏈下直接解密，或在票值公開前提下直接鏈上計票）。
- **前端 DApp**: **VeRange特化配置** (必須生成 VeRange Type-1 證明並提交)。
- **MPC 系統**: **不使用或極度簡化** (例如，僅用於對已驗證的加密選票進行解密，若有此需求)。
**需測量指標**:
- 選民註冊 Gas 消耗。
- **VeRange 證明生成時間 (前端)**。
- **`submitEncryptedBallot` (含 `verifyVeRange`) Gas 消耗** - 這是核心測量點。
- 不同選票數量下的平均 Gas 消耗。

### Module X.4: 情境 3 - 結合 MPC 與 VeRange Type-1
**目標**: 評估整合方案的系統表現，即鏈上 VeRange 驗證 + 鏈下 MPC 計票。這是您 `technical_blueprint.md` 中描述的完整系統。
**配置**:
- **ManagementContract**: **完整功能版**。
- **CountingContract**: **完整功能版/配置** (例如 `CountingContract` 部署時設置 `veRangeVerificationEnabled = true`)。其 `submitEncryptedBallot` 函數必須執行 `verifyVeRange`。
- **前端 DApp**: **完整功能版** (生成 VeRange 證明並提交)。
- **MPC 系統**: **完整功能版**，執行秘密分享、安全聚合、安全排序。
**需測量指標**:
- 選民註冊 Gas 消耗。
- VeRange 證明生成時間 (前端)。
- `submitEncryptedBallot` (含 `verifyVeRange`) Gas 消耗。
- MPC 任務派發 Gas 消耗。
- MPC 執行時間。
- 結果發布 Gas 消耗。
- 端到端的總體投票時間和 Gas 成本。

### Module X.5: 數據分析與報告撰寫
**目標**: 整理實驗數據，比較三種情境下的系統表現，並撰寫分析報告。
**任務**:
- 數據可視化 (圖表)。
- 性能瓶頸分析。
- 對比不同技術組合的優劣。
- 總結研究發現和未來優化方向。