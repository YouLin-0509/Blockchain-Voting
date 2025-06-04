const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("🔄 開始一鍵重新部署流程...");

// 步驟1：停止現有的Hardhat節點（如果在運行）
console.log("\n📢 步驟1：準備重新啟動區塊鏈節點...");

// 步驟2：啟動新的Hardhat節點
console.log("📢 步驟2：啟動新的Hardhat節點...");
const nodeProcess = spawn('npx', ['hardhat', 'node'], {
  stdio: 'pipe',
  shell: true
});

let nodeReady = false;

nodeProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[節點] ${output}`);
  
  // 檢測節點是否準備就緒
  if (output.includes('Started HTTP and WebSocket JSON-RPC server') || 
      output.includes('Account #0:')) {
    if (!nodeReady) {
      nodeReady = true;
      setTimeout(() => {
        deployContracts();
      }, 2000); // 等待2秒確保節點完全啟動
    }
  }
});

nodeProcess.stderr.on('data', (data) => {
  console.error(`[節點錯誤] ${data}`);
});

// 步驟3：部署智能合約
function deployContracts() {
  console.log("\n📢 步驟3：部署智能合約...");
  
  const deployProcess = spawn('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost'], {
    stdio: 'pipe',
    shell: true
  });

  deployProcess.stdout.on('data', (data) => {
    console.log(`[部署] ${data}`);
  });

  deployProcess.stderr.on('data', (data) => {
    console.error(`[部署錯誤] ${data}`);
  });

  deployProcess.on('close', (code) => {
    if (code === 0) {
      console.log("\n✅ 重新部署完成！");
      console.log("📋 摘要：");
      console.log("  - 新的區塊鏈節點已啟動");
      console.log("  - 智能合約已重新部署");
      console.log("  - 前端配置已自動更新");
      console.log("  - 所有資料已重置");
      console.log("\n🌐 請刷新瀏覽器頁面以載入新的合約配置");
      
      // 創建完成標記文件
      const completionFile = path.join(__dirname, '../frontend/public/redeploy-complete.json');
      fs.writeFileSync(completionFile, JSON.stringify({
        completed: true,
        timestamp: new Date().toISOString()
      }, null, 2));
      
    } else {
      console.error(`❌ 部署失敗，退出代碼: ${code}`);
      nodeProcess.kill();
      process.exit(1);
    }
  });
}

// 處理程序終止
process.on('SIGINT', () => {
  console.log('\n🛑 收到終止信號，正在清理...');
  if (nodeProcess) {
    nodeProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到終止信號，正在清理...');
  if (nodeProcess) {
    nodeProcess.kill();
  }
  process.exit(0);
}); 