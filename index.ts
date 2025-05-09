import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CARGO_HOME } from './src/cache';
import { installBins, restoreCache } from './src/cargo';
import { installToolchain } from './src/rust';

export async function installRustup() {
	try {
		await io.which('rustup', true);
        core.info('rustup already exists, skipping installation');
		return;
	} catch {
		// Doesn't exist
	}

	core.info('rustup does not exist, attempting to install');

	const script = await tc.downloadTool(
		process.platform === 'win32' ? 'https://win.rustup.rs' : 'https://sh.rustup.rs',
		path.join(os.tmpdir(), 'rustup-init'),
	);

	core.info(`Downloaded installation script to ${script}`);

	// eslint-disable-next-line no-magic-numbers
	await fs.promises.chmod(script, 0o755);

	await exec.exec(script, ['--default-toolchain', 'none', '-y']);

	core.info('Installed rustup');
}

async function run() {
	core.info('Setting cargo environment variables');

	core.exportVariable('CARGO_INCREMENTAL', '0');
	core.exportVariable('CARGO_TERM_COLOR', 'always');

	core.info('Adding ~/.cargo/bin to PATH');

	core.addPath(path.join(CARGO_HOME, 'bin'));

	try {
		// Restore cache after the toolchain has been installed,
		// as we use the rust version and commit hashes in the cache key!
		await restoreCache();
		await installRustup();
        try {
            await io.which('cargo', true);
            await io.which('rustc', true);
            await io.which('cargo-binstall', true);
            core.info('toolchain already exist, skipping installation');
        } catch {
            // Doesn't exist
            await installToolchain();
            await installBins();
        }
	} catch (error: unknown) {
		core.setFailed((error as Error).message);

		throw error;
	}
}

void run();
