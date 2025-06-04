# 區塊鏈多方安全電子投票系統技術藍本
結合《Multi-party confidential verifiable electronic voting scheme based on blockchain》與《VeRange: Verification-efficient Zero-knowledge Range  Arguments with Transparent Setup for Blockchain Applications  and More》的 Type-1 範圍論證整合成一個可落地的系統

---

## 0. 系統總覽

```
┌───────── Front-End DApp (React + wagmi) ─────────┐
│ 1. WalletConnect / MetaMask                     │
│ 2. Registration & Voting UI                     │
│ 3. VeRange-Proof Generator (Web-Worker)         │
└──────────────────────────────────────────────────┘
                 │ JSON-RPC
                 ▼
┌───────────────── Ethereum / EVM ─────────────────┐
│ ManagementContract (SCm)   CountingContract (SCt)│
│  • registerVoter()         • submitEncryptedBallot()│
│  • closeRegistration()     • verifyVeRange()        │
│  • dispatchMPC()           • storeCID()             │
│  • events / logs           • publishResult()        │
└──────────────────────────────────────────────────┘
                 │ TaskSpec (IPFS CID)
                 ▼
┌────────── Off-chain MPC Network (N節點) ──────────┐
│ 1. Shamir Share DB           4. Secure Sort       │
│ 2. Secure Aggregate Σ        5. Encrypt→SCt       │
│ 3. VeRange batch check (opt) │                    │
└──────────────────────────────────────────────────┘
                 ▲                         │
                 │ Encrypted ballot (CID, VeRange π)
┌─────────────── IPFS / Pinning Service ────────────┐
│ Stores: encryptedBallot.json, taskSpec.json, etc. │
└────────────────────────────────────────────────────┘
```

---

## 1. 密碼基本元件與建議實作庫

| 功能         | 演算法                                   | 庫/框架 (JS/TS)                | 參數建議                            |
|--------------|------------------------------------------|--------------------------------|-------------------------------------|
| **身份匿名** | Short Linkable **Ring Signature** (ECC)   | `@noble/ed25519` + custom wrapper | `n≈64` 公鑰環                   |
| **票值隱私** | Shamir (t,n) Secret Sharing              | `shamirs-secret-sharing`       | `n = #MPC節點`, `t = ⌈n/2⌉`         |
| **票值合法性** | **VeRange Type-1** ZK Range Argument    | 官方 Solidity + TS SDK (`verange` repo) | 32–64 bit range；聚合批次大小 T≤32 |
| **票值加密** | ElGamal on secp256k1                     | `elliptic` 或 `noble-secp256k1` | pk = 候選人公鑰                     |
| **雜湊/承諾** | Keccak-256 / Poseidon (用於 ZKP)         | `ethers.utils.keccak256`, `circomlibjs` | —             |

---

## 2. 智慧合約模組 (Solidity ≥ 0.8.22)

### 2.1 ManagementContract (SCm)

| Function                            | Gas-關鍵 | 說明                                                                 |
|-------------------------------------|----------|----------------------------------------------------------------------|
| `register(bytes ringSig, bytes pkSet)` | ~70 K    | 驗 RingSignature → 產生 `IDi` 與 `mapping(ID⇒address)`；回傳 event `Registered(IDi)` |
| `closeRegistration()`               | ~30 K    | 設 `registrationClosed = true`；emit 註冊總數                             |
| `dispatchMPC(uint voters, uint candidates)` | ~45 K | 生成 TaskSpec(JSON) → IPFS 上傳 → 紀錄 CID                             |
| `grantResultViewer(address auth)`   | ~20 K    | 授權 candidate 公鑰查看結果                                             |

### 2.2 CountingContract (SCt)

| Function                                            | Gas-關鍵           | 說明                                                                                                     |
|-----------------------------------------------------|--------------------|----------------------------------------------------------------------------------------------------------|
| `submitEncryptedBallot(bytes32 cid, bytes veRangeProof)` | **~253 K (Type-1)** | 先 `verifyVeRange()`，後記錄 `cid → mapping(ID)`；驗證失敗 `revert`                                        |
| `publishResult(bytes encΣ, bytes encSorted)`        | ~110 K             | 由 MPC threshold ≥ t 節點簽名後提交；寫 `ResultPublished` event                                            |
| `verifyVeRange(bytes proof)`                        | 內部               | 調官方 pre-compiled 或 library；32–64 bit 約 **3 √N G Exp**                                             |

> **Gas 估算**：64-bit Type-1 驗證 16 張選票在鏈上 ≈ 351 K Wei ≈ \$7.7 (7 Gwei, ETH=\$3140)。

---

## 3. 協定階段（Message & Storage-Level）

| 階段       | 鏈上狀態                       | 鏈下/訊息                                                                                                 |
|------------|--------------------------------|------------------------------------------------------------------------------------------------------------|
| **① Registration** | `Registered(IDi)` event        | DApp 產生 `(pk_i, sk_i)`，組成 PK 環 → ringSig → `register()`                                            |
| **② Voting**       | `BallotCID[IDi]` mapping 更新 | 前端：<br>1. `Enc(pk_cand, vote)`<br>2. 產生 VeRange π<br>3. 上傳 `ballot.json` → IPFS，回傳 CID         |
| **③ Proof Check**  | `submitEncryptedBallot()`      | SCt 內部驗證 π；成功 emit `BallotAccepted(IDi)`                                                         |
| **④ MPC Dispatch** | `TaskCID`                    | SCm `dispatchMPC()`：TaskSpec 包含 index list、share params、curve 等                                       |
| **⑤ Secure Σ/Sort**| —                              | MPC 節點 pull TaskSpec → 下載 ballot 密文 → 本地 share → Σ → Sort → 閾值加密 result                        |
| **⑥ Publish Result** | `ResultPublished(encΣ, encSort)` | encΣ & encSort 用候選人 pk 加密，附 ≥ t 節點簽名                                                        |
| **⑦ Verification**  | 任意人可重播分享 & VeRange      | 前端/監票方重建 share → Σ、排序；比對鏈上 encΣ 哈希                                                         |

---

## 4. Off-chain MPC 節點詳述

| 步驟         | 演算法                                                                                  | 通訊                                            |
|--------------|-----------------------------------------------------------------------------------------|-------------------------------------------------|
| **ShareGen** | 將每票密文值視為 `S_i`，選 `(t-1)` 階多項式 <br>`f_i(x) = S_i + ∑_{j=1}^{t-1} a_{ij} x^j` | gRPC/WebSocket → broadcast `share_i[j]`         |
| **Local Σ**  | 收到 n 條 `share` → 求和 `F(x_j)`                                                       | —                                               |
| **Recover 常數項** | 逆 Vandermonde · `F` → 得 `Σ`                                                            | —                                               |
| **Secure Sort** | 隨機位移 + Shamir share 再計算 → `T_i`                                                   | —                                               |
| **Encrypt Result** | `Enc(pk_cand, Σ || sortedList)`                                                         | POST → SCt.publishResult                         |

> 建議使用 **Rust + arkworks** 作 MPC 節點，以取得高效曲線與 FFT；或使用 Go 方便與 IPFS/libp2p 整合。

---

## 5. VeRange Type-1 整合細則

1. **前端產生證明**  
   - 使用官方 TS SDK；將票值 `v ∈ {0,1,…,m}`（最多 m 候選）填入 Pedersen-commitment。  
   - 若一次送出多張票（不常見，但可用於批次測試），可用 `aggregateProof(proofs[])` 聚合多張證明。

2. **鏈上驗證**  
   - SCt 呼叫 library 的 `verify()` 方法。VeRange Type-1 驗證複雜度為 `3 √N` 群冪次；例如 64-bit 約 166K 群運算。

3. **與 Shamir ID 不衝突**  
   - VeRange 證明僅對密文 commit；不包含身份資訊，仍需依賴 Ring Signature 隱匿 ID。

---

## 6. 參數與部署設定建議

| 項目            | 推薦值                   | 理由                                                                   |
|-----------------|--------------------------|------------------------------------------------------------------------|
| **Curve**       | secp256k1 (EVM 預編譯)   | gas 最低、工具支援度高                                                   |
| **VeRange bits**| 32 bit                   | 足以支援 0–4G 票數；驗證 gas 最低                                         |
| **MPC 節點數 n**| 7                        | 容錯 F = ⌊(n-1)/2⌋=3；適用於中小型組織                                   |
| **閾值 t**      | 4 (= ⌈n/2⌉)             | 少於 4 節點無法揭密 Σ                                                     |
| **IPFS**        | Pinning Service + 本地閘道| 保證結果可驗證且檔案可長期保存                                           |
| **Gas 上限**    | 10 M/block (Goerli*)     | 一輪投票 ≤ 400 名選民皆可寫入                                            |

---

## 7. 測試與驗證

1. **單元測試**  
   - Hardhat + `chai`；模擬 n=3 投票、重複投票應 `revert`。  
   - 測試 VeRange π 不合法 → `revert("INVALID_ZKP")`。

2. **安全測試**  
   - Echidna/Fuzz：隨機 `ballot CID`、`proof`、`ID` 組合。  
   - MythX：檢查重入、uint 溢位（Solidity 0.8.X 已自動檢查）。

3. **性能基準**  
   - 本地 Anvil：量測 `submitEncryptedBallot()` gas；比較 Bulletproofs vs VeRange（Type-1 省約 80%）。

---

## 8. 常見落坑與對策

| 風險                   | 對策                                                                    |
|------------------------|-------------------------------------------------------------------------|
| **Ring 環太小導致連結攻擊** | public key pool ≥ 64；定期插入 Dummy 公鑰                               |
| **IPFS CID 被垃圾收集**      | 使用 Pinning Service + 定期巡檢；將 CID 寫入 SC 事件                         |
| **MPC 節點離線**         | 使用 libp2p ping；若 < t 節點簽名自動切換至 standby 節點                       |
| **Proof 大小超過 calldata 上限** | 32-64 bit Type-1 < 768 B；若仍過大 → 先上傳至 IPFS，SC 僅驗證 CID 哈希  |

---

## 9. 延伸優化 (可列入 Phase-2)

- **VeRange Type-2B / Type-3 聚合**：一次驗證上千筆票，可再縮小 proof size 20–40%。  
- **zk-EVM L2**：將 SCt 部署到 Scroll/Linea 等 zkRollup，以進一步降低 gas。  
- **BLS-based Ring Signature**：支援批次驗證與 Linkable trait。  
- **Bulletproof / Pedersen Voting Value Compression**：若需浮點或權重投票，可採用 Bulletproof++。

---

### 小結

- **鏈下**：透過 Shamir (t,n) 分享 + MPC Σ/排序，確保票值隱私 (少於 t 節點無法還原)。  
- **鏈上**：利用 SCm / SCt 分工，VeRange 驗證「票值合法性」、Ring Signature 隱匿「投票者身份」。  
- **成本**：64-bit VeRange Type-1 單票驗證約 350K gas；比 Bulletproofs 節省 80–90%。  
- **安全**：IND-CCA2 加密確保結果僅授權者可讀；所有 share / proof / Σ 均可公開驗證。
