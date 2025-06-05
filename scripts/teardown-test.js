const fs = require('fs');
const path = require('path');

const simpleTallyPath = path.join(__dirname, '..', 'contracts', 'plugins', 'SimpleTally.sol');
const simpleTallyBackupPath = simpleTallyPath + '.bak';

function teardown() {
    console.log('Cleaning up temporary SimpleTally.sol...');
    if(fs.existsSync(simpleTallyPath)) {
        fs.unlinkSync(simpleTallyPath);
    }
    
    console.log('Restoring original SimpleTally.sol...');
    if (fs.existsSync(simpleTallyBackupPath)) {
        fs.renameSync(simpleTallyBackupPath, simpleTallyPath);
    }
    console.log('Teardown complete.');
}

teardown(); 