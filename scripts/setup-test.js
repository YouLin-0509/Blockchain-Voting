const fs = require('fs');
const path = require('path');

const simpleTallyPath = path.join(__dirname, '..', 'contracts', 'plugins', 'SimpleTally.sol');
const simpleTallyBackupPath = simpleTallyPath + '.bak';

const simpleTallyContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./base/TallyBase.sol";

contract SimpleTally is TallyBase {
    constructor(string[] memory _candidates) TallyBase(_candidates) {}

    function tallyCommitment(
        address,
        uint256,
        uint256
    ) external pure {
        // Dummy implementation for compilation purposes
    }

    function getTally() external view returns (uint256[] memory) {
        uint256[] memory dummyTally = new uint256[](candidates.length);
        return dummyTally;
    }
}
`;

function setup() {
    console.log('Backing up SimpleTally.sol...');
    if (fs.existsSync(simpleTallyPath)) {
        fs.renameSync(simpleTallyPath, simpleTallyBackupPath);
    }
    console.log('Writing temporary SimpleTally.sol for testing...');
    fs.writeFileSync(simpleTallyPath, simpleTallyContent, 'utf8');
    console.log('Setup complete.');
}

setup(); 