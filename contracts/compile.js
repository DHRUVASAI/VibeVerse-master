const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, 'VibePassport.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'VibePassport.sol': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode']
            }
        },
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};

console.log('Compiling VibePassport.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    let hasError = false;
    output.errors.forEach(err => {
        console.error(err.formattedMessage);
        if (err.severity === 'error') hasError = true;
    });
    if (hasError) process.exit(1);
}

const contract = output.contracts['VibePassport.sol']['VibePassport'];
const artifact = {
    contractName: 'VibePassport',
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object
};

// Write to contracts and src directories
const outDir1 = path.resolve(__dirname);
const outDir2 = path.resolve(__dirname, '../src/contracts');

if (!fs.existsSync(outDir2)) {
    fs.mkdirSync(outDir2, { recursive: true });
}

fs.writeFileSync(path.join(outDir1, 'VibePassport.json'), JSON.stringify(artifact, null, 2));
fs.writeFileSync(path.join(outDir2, 'VibePassport.json'), JSON.stringify(artifact, null, 2));

console.log('✅ Compilation successful! Saved to contracts/VibePassport.json & src/contracts/VibePassport.json');
