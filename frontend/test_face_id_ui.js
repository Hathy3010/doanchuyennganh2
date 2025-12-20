#!/usr/bin/env node
/**
 * Face ID UI Testing Script
 * Tests the frontend Face ID implementation with pose diversity
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class FaceIDUITester {
    constructor() {
        this.frontendPath = path.join(__dirname);
        this.backendUrl = 'http://localhost:8001';
    }

    checkDependencies() {
        console.log('🔍 Checking frontend dependencies...');

        try {
            // Check if node_modules exists
            if (!fs.existsSync(path.join(this.frontendPath, 'node_modules'))) {
                console.log('❌ node_modules not found. Installing dependencies...');
                execSync('npm install', { cwd: this.frontendPath, stdio: 'inherit' });
            }

            // Check if expo-cli is available
            try {
                execSync('npx expo --version', { stdio: 'pipe' });
                console.log('✅ Expo CLI available');
            } catch {
                console.log('⚠️  Expo CLI not found. Installing...');
                execSync('npm install -g @expo/cli', { stdio: 'inherit' });
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to check/install dependencies:', error.message);
            return false;
        }
    }

    checkBackendConnection() {
        console.log('🔍 Checking backend connection...');

        try {
            const response = require('child_process').execSync(`curl -s -o /dev/null -w "%{http_code}" ${this.backendUrl}/docs`, { encoding: 'utf-8' });

            if (response.trim() === '200') {
                console.log('✅ Backend server is running');
                return true;
            } else {
                console.log(`❌ Backend server responded with status ${response}`);
                return false;
            }
        } catch (error) {
            console.log('❌ Cannot connect to backend server');
            console.log('   Please start backend with: python -m uvicorn main:app --host 0.0.0.0 --port 8001');
            return false;
        }
    }

    validateFrontendCode() {
        console.log('🔍 Validating frontend code structure...');

        const studentFile = path.join(this.frontendPath, 'app/(tabs)/student.tsx');

        if (!fs.existsSync(studentFile)) {
            console.log('❌ student.tsx not found');
            return false;
        }

        try {
            const content = fs.readFileSync(studentFile, 'utf8');

            // Check for Face ID related code
            const checks = [
                { pattern: 'detectFaceAndAngle', description: 'Face angle detection function' },
                { pattern: 'collectedAngles', description: 'Pose diversity angle collection' },
                { pattern: 'requiredFrames', description: 'Frame collection requirement' },
                { pattern: 'processFaceSetupFromFrames', description: 'Face ID setup processing' },
                { pattern: 'cameraCircleContainer', description: 'Circular camera UI' },
                { pattern: 'Quay đầu chậm rãi theo vòng tròn', description: 'Face ID style instructions' }
            ];

            let allChecksPass = true;

            for (const check of checks) {
                if (content.includes(check.pattern)) {
                    console.log(`✅ Found: ${check.description}`);
                } else {
                    console.log(`❌ Missing: ${check.description}`);
                    allChecksPass = false;
                }
            }

            return allChecksPass;

        } catch (error) {
            console.error('❌ Error reading student.tsx:', error.message);
            return false;
        }
    }

    testFrontendBuild() {
        console.log('🔍 Testing frontend build...');

        try {
            // Try to run expo start --clear in dry-run mode
            console.log('   Note: This test checks if the app can be parsed without syntax errors');
            console.log('   Full UI testing requires running on device/emulator');

            // Basic syntax check by trying to parse the file
            const studentFile = path.join(this.frontendPath, 'app/(tabs)/student.tsx');
            const content = fs.readFileSync(studentFile, 'utf8');

            // Check for basic syntax issues
            const lines = content.split('\n');
            let openBraces = 0;
            let openParens = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                for (const char of line) {
                    if (char === '{') openBraces++;
                    if (char === '}') openBraces--;
                    if (char === '(') openParens++;
                    if (char === ')') openParens--;
                }
            }

            if (openBraces !== 0) {
                console.log(`❌ Syntax error: Unmatched braces (${openBraces})`);
                return false;
            }

            if (openParens !== 0) {
                console.log(`❌ Syntax error: Unmatched parentheses (${openParens})`);
                return false;
            }

            console.log('✅ Basic syntax validation passed');
            return true;

        } catch (error) {
            console.error('❌ Build test failed:', error.message);
            return false;
        }
    }

    runUITests() {
        console.log('\n📱 Frontend UI Test Checklist:');
        console.log('   □ Camera displays in circular mask');
        console.log('   □ Progress shows frames collected (0/30)');
        console.log('   □ Instructions mention "vòng tròn"');
        console.log('   □ No pose-specific directions (left/right/up)');
        console.log('   □ Face ID setup completes with 30 frames');
        console.log('   □ Pose diversity validation works');

        console.log('\n📋 Manual Testing Steps:');
        console.log('1. Start frontend: npx expo start');
        console.log('2. Open on device/emulator');
        console.log('3. Login as student');
        console.log('4. Go to Face ID setup');
        console.log('5. Verify camera shows in circle');
        console.log('6. Check progress shows 0/30');
        console.log('7. Try Face ID setup process');
        console.log('8. Verify it collects frames and completes');

        return true; // Return true since these are manual checks
    }

    runAllTests() {
        console.log('🚀 Starting Face ID Frontend Tests');
        console.log('=' * 50);

        let allPassed = true;

        // Test 1: Dependencies
        if (!this.checkDependencies()) {
            allPassed = false;
        }

        // Test 2: Backend connection
        if (!this.checkBackendConnection()) {
            allPassed = false;
        }

        // Test 3: Frontend code validation
        if (!this.validateFrontendCode()) {
            allPassed = false;
        }

        // Test 4: Build test
        if (!this.testFrontendBuild()) {
            allPassed = false;
        }

        // Test 5: UI checklist
        this.runUITests();

        console.log('\n' + '=' * 50);

        if (allPassed) {
            console.log('✅ Frontend automated tests passed!');
            console.log('   - Dependencies: ✅');
            console.log('   - Backend connection: ✅');
            console.log('   - Code structure: ✅');
            console.log('   - Syntax validation: ✅');
            console.log('   - UI checklist: 📋 (Manual)');
        } else {
            console.log('❌ Some automated tests failed.');
        }

        return allPassed;
    }
}

function main() {
    console.log('Face ID Frontend Testing Script');
    console.log('Tests the new Face ID pose diversity UI implementation');
    console.log();

    const tester = new FaceIDUITester();
    const success = tester.runAllTests();

    if (success) {
        console.log('\n🎊 Frontend is ready for Face ID testing!');
        console.log('   Next: Run manual UI tests on device/emulator');
    } else {
        console.log('\n❌ Frontend has issues. Please fix before testing.');
    }

    return success;
}

if (require.main === module) {
    main();
}
