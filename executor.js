const fs = require('fs');
const { exec } = require('child_process');

const code = `
#include <iostream>
using namespace std;
int main() {
    cout << "Execution successful. Hello from the Node.js bridge." << endl;
    return 0;
}
`;

const fileName = 'temp.cpp';
const outputName = 'temp.out'; 

console.log("Writing file to disk...");
fs.writeFileSync(fileName, code);

console.log("Compiling...");
exec(`g++ ${fileName} -o ${outputName}`, (compileError, compileStdout, compileStderr) => {
    
    if (compileError) {
        console.error("Compilation Error:");
        console.error(compileStderr);
        return; 
    }

    console.log("Compilation successful. Running binary...");

    exec(`./${outputName}`, (runError, runStdout, runStderr) => {
        
        if (runError) {
            console.error("Runtime Error:");
            console.error(runStderr);
            return;
        }

        console.log("Final Output:");
        console.log(runStdout);
    });
});