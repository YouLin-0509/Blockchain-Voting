以下 **「Base System Refactor SPEC v1.0」** 以 *精確可執行* 的層級列出每一項調整，確保整個 base system 與 MPC／ZKP 完全解耦。建議將本文件直接放入 `docs/specs/base_system_refactor.md`，後續 PR 以此為依據做 Code Review。

---

## 0. 版本與前置條件

| 項目              | 要求                                            |
| --------------- | --------------------------------------------- |
| Solidity        | `^0.8.24`                                     |
| Hardhat         | `^2.22.0`                                     |
| hardhat‐toolbox | `^3.0.0` (含 waffle、ethers v5)                 |
| Node.js         | ≥ 18.0                                        |
| Front-end       | React 18 + wagmi 1.x                          |
| Branch 基準       | `feat/base-voting-system`（已調整 contracts 目錄結構） |

---

## 1. 目錄結構 (完成後應長這樣)

```
contracts/
├─ common/               # 已存在
│   ├─ Identity.sol
│   ├─ BallotStorage.sol
│   └─ Errors.sol
├─ interfaces/
│   ├─ ITally.sol        # 本 SPEC 新增 (空介面, 供未來用)
│   └─ IVerifier.sol     # 本 SPEC 新增
├─ plugins/
│   └─ base/
│       └─ VotingBase.sol  ✓ 本 SPEC 完整重寫 (唯一 plugin)
└─ (其他 plugins 子目錄全部移除/清空)
scripts/
├─ deploy-base.js         ✓ 本 SPEC 新增
test/
├─ votingBase.test.js     ✓ 本 SPEC 新增或覆寫
frontend/
└─ (詳 § 5)
```

---

## 2. 檔案增刪 & Git 操作

| 動作                   | 檔案/目錄                                                   | 指令 (示例)                                   |
| -------------------- | ------------------------------------------------------- | ----------------------------------------- |
| **刪除**               | `contracts/ManagementContract.sol`                      | `git rm contracts/ManagementContract.sol` |
| **刪除**               | `contracts/*Compute*.sol`, `contracts/*Dispatcher*.sol` | `git rm`                                  |
| **清空 plugins 其餘子目錄** | `contracts/plugins/mpc/`, `plugins/verange/` 等          | `git rm -r …`                             |
| **新增**               | `contracts/interfaces/ITally.sol`                       | `touch … && git add`                      |
| **新增**               | `contracts/interfaces/IVerifier.sol`                    | 同上                                        |
| **新增 (重寫)**          | `contracts/plugins/base/VotingBase.sol`                 | 同上                                        |
| **新增**               | `scripts/deploy-base.js`                                | 同上                                        |
| **新增/覆寫**            | `test/votingBase.test.js`                              | 同上                                        |
| **新增**               | `docs/specs/base_system_refactor.md`                    | 同上                                        |

> **Commit message 建議**：`feat(base): standalone base system (no MPC / no ZKP) – SPEC v1.0 implementation`

---

## 3. Smart-Contract 詳規

### 3.1 interfaces/ITally.sol  *(為未來插件預留, Base 不實作)*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITally {
    function tallyAll(bytes32[] calldata ballotCIDs) external;
}
```

### 3.2 interfaces/IVerifier.sol  *(同上)*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerifier {
    function verify(bytes calldata proof) external view returns (bool);
}
```

### 3.3 VotingBase.sol  (完整內容)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotingBase
 * @notice Pure on-chain baseline voting contract – no MPC, no ZKP.
 * @dev  phasing: Register → Voting → Ended
 */
contract VotingBase {
    /* ---------- Types & Storage ---------- */
    enum Phase { Register, Voting, Ended }
    Phase   public phase = Phase.Register;

    address public immutable admin;
    string[] public candidates;                    // candidateId = idx
    mapping(address => bool) public isVoter;
    mapping(address => bool) public hasVoted;
    mapping(uint256  => uint256) private _results; // candidateId → votes

    /* ---------- Events ---------- */
    event VoterRegistered(address indexed voter);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event PhaseSwitched(Phase indexed newPhase);

    /* ---------- Modifiers ---------- */
    modifier onlyAdmin()            { require(msg.sender == admin, "NOT_ADMIN");  _; }
    modifier inPhase(Phase want)    { require(phase == want,      "BAD_PHASE");  _; }

    /* ---------- Constructor ---------- */
    constructor(string[] memory _cand) {
        admin      = msg.sender;
        candidates = _cand;
    }

    /* ---------- Admin Methods ---------- */
    function addVoter(address voter)
        external onlyAdmin inPhase(Phase.Register)
    {
        require(!isVoter[voter], "DUP");
        isVoter[voter] = true;
        emit VoterRegistered(voter);
    }

    function startVoting()
        external onlyAdmin inPhase(Phase.Register)
    {
        phase = Phase.Voting;
        emit PhaseSwitched(phase);
    }

    function endVoting()
        external onlyAdmin inPhase(Phase.Voting)
    {
        phase = Phase.Ended;
        emit PhaseSwitched(phase);
    }

    /* ---------- Voting ---------- */
    function vote(uint256 candidateId)
        external inPhase(Phase.Voting)
    {
        require(isVoter[msg.sender],      "NOT_VOTER");
        require(!hasVoted[msg.sender],    "ALREADY");
        require(candidateId < candidates.length, "BAD_ID");

        hasVoted[msg.sender] = true;
        _results[candidateId] += 1;
        emit VoteCast(msg.sender, candidateId);
    }

    /* ---------- Read-only ---------- */
    function result(uint256 id)
        external view returns (uint256)
    {
        require(phase == Phase.Ended, "NOT_ENDED");
        return _results[id];
    }

    function allResults()
        external view returns (uint256[] memory out)
    {
        require(phase == Phase.Ended, "NOT_ENDED");
        out = new uint256[](candidates.length);
        for (uint256 i; i < candidates.length; ++i) out[i] = _results[i];
    }
}
```

* **Gas 估算**：`vote()` ≤ 45 kGas (無存大陣列)；`allResults()` 為 `view`.
* **安全性**：僅 admin 可改 Phase；重複投票、越界 candidate 均會 revert。

---

## 4. Hardhat & Script

### 4.1 `hardhat.config.js` 需確認

```js
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: { localhost: { url: "http://127.0.0.1:8545" } }
};
```

### 4.2 新增 `scripts/deploy-base.js`

```js
const { ethers, run } = require("hardhat");

async function main() {
  const cand = ["Alice", "Bob", "Carol"];
  const VotingBase = await ethers.getContractFactory("VotingBase");
  const votingBase = await VotingBase.deploy(cand);
  await votingBase.deployed();

  console.log("VotingBase deployed to:", votingBase.address);
  // 可選 verify: await run("verify:verify", { address: votingBase.address, constructorArguments:[cand]});
}
main().catch((e) => { console.error(e); process.exit(1); });
```

### 4.3 `package.json` script (新增 / 修改)

```json
"scripts": {
  "dev":      "hardhat node",
  "deploy":   "hardhat run scripts/deploy-base.js --network localhost",
  "test":     "hardhat test"
}
```

---

## 5. Front-end 修改 (React / wagmi)

> 所有以下路徑以 `frontend/` 為根。

### 5.1 環境變數

`.env` 新增

```
REACT_APP_VOTING_ADDRESS=<待部署後填入>
REACT_APP_VERSION=base
```

### 5.2 `src/config/contracts.js`

```js
export const VOTING_ADDRESS = process.env.REACT_APP_VOTING_ADDRESS;
export const VOTING_ABI = require("./abi/VotingBase.json");
```

*(ABI 由 `artifacts/contracts/plugins/base/VotingBase.sol/VotingBase.json` 複製)*

### 5.3 Hooks 主要變動

* `useVote(candId)` → `contract.vote(candId)`
* `usePhase()` → 讀 `phase()` (enum number)
* `useResults()` →在 phase==Ended 時呼叫 `allResults()`

### 5.4 移除 / 隱藏

* 與 IPFS CID、proof、taskCID 相關的 UI 皆暫時 **hide** (`BUILD_VERSION === 'base'`)。

---

## 6. 測試 `test/votingBase.test.js`

```js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingBase", () => {
  let voting, owner, voter1, voter2, stranger;
  beforeEach(async () => {
    [owner, voter1, voter2, stranger] = await ethers.getSigners();
    const VotingBase = await ethers.getContractFactory("VotingBase");
    voting = await VotingBase.deploy(["A", "B"]);
    await voting.deployed();
  });

  it("should register voter and prevent duplicate vote", async () => {
    await voting.addVoter(voter1.address);
    await voting.startVoting();
    await voting.connect(voter1).vote(0);
    await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("ALREADY");
  });

  it("stranger cannot vote", async () => {
    await voting.startVoting();
    await expect(voting.connect(stranger).vote(0)).to.be.revertedWith("NOT_VOTER");
  });

  it("tally correct", async () => {
    await voting.addVoter(voter1.address);
    await voting.addVoter(voter2.address);
    await voting.startVoting();
    await voting.connect(voter1).vote(0);
    await voting.connect(voter2).vote(1);
    await voting.endVoting();
    const res = await voting.allResults();
    expect(res.map(x=>x.toNumber())).to.deep.equal([1,1]);
  });
});
```

---

## 7. CI / GitHub Actions (可選)

* Workflow `base.yml`：

  1. `npm ci` → `npm run test`
  2. `npx hardhat coverage` (目標 coverage ≥ 90 %)

---

## 8. 驗收標準 (Acceptance Criteria)

| #    | 驗收項目                                                                  | 驗證方式                   |
| ---- | --------------------------------------------------------------------- | ---------------------- |
| AC-1 | 本地 Hardhat `npx hardhat node` + `npm run deploy` 可正常部署，console 顯示合約地址 | 手動                     |
| AC-2 | 測試 `npm test` 全通過                                                     | GitHub Actions         |
| AC-3 | `vote()` 單次 Gas ≤ 45 k                                                | `hardhat-gas-reporter` |
| AC-4 | 前端在 Register/Voting/Ended 三階段能正確切換 UI 與顯示結果                           | 瀏覽器手動                  |
| AC-5 | repo 內 **完全沒有** `Management*`, `Compute*`, `MPC*`, `Verifier*` 智慧合約   | 靜態檢查                   |
| AC-6 | `docs/specs/base_system_refactor.md` 與實作一致                            | Code Review            |

---

## 9. 時程建議

| Day | 任務                                                |
| --- | ------------------------------------------------- |
| D1  | 完成檔案增刪 & VotingBase.sol 實作；本地測試通過                 |
| D2  | 更新部署腳本 + 前端接線；手動 E2E 測試                           |
| D3  | 撰寫測試、CI、文檔；提交 MR/PR                               |
| D4  | Review & Merge 至 `main` / release tag `v0.1-base` |

---

### 備註

1. **不要** 在此分支引入任何 ZKP 依賴 (snarkjs, circom) 或 docker-mpc。
2. 後續三種系統 (MPC / VeRange / MPC+VeRange) 需由 **獨立分支** 基於此版本向前疊加。
