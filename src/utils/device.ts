import {  execSync as execCommandSync } from 'node:child_process'

export class Device {
	constructor(public host?: string) {
		if (host) {
			this.connect()
		}
	}
	static list(filterOffline: boolean = true) {
		const res = this.prototype.exec('adb devices')
		if (res.error) {
			throw new Error(res.error)
		}
		const middle = res.stdout.trim().split('\r\n').slice(1)
		const list = middle.map(it => {
			const [serial, status] = it.split('\t')
			return { serial, status }
		})
		return filterOffline ? list.filter(it => it.status === 'device') : list
	}
	exec(command: string): { stdout: string, stderr: string | null, error: string | null } {
		try {
			const stdout = execCommandSync(command, {
				env: { ANDROID_SERIAL: this.host },
				encoding: 'utf8',
				stdio: 'pipe', // 捕获标准输出和标准错误流
			})
			return { stdout, stderr: null, error: null }
		} catch (err: any) {
			return { stdout: err.stdout, stderr: err.stderr, error: err.message }
		}
	}
	private connect() {
		const res = this.exec(`adb connect ${this.host}`)
		if (res.stdout.includes('cannot')) {
			throw new Error(res.stdout)
		}
	}
	/** 反向端口转发 */
	reverse(remote: number, local: number) {
		return this.exec(`adb reverse tcp:${remote} tcp:${local}`)
	}
	removeReverse(port?: number) {
		const removeMethod = port ? `--remove tcp:${port}` : "--remove-all"
		return this.exec(`adb reverse ${removeMethod}`)
	}
	push(local: string, remote: string) {
		return this.exec(`adb push ${local} ${remote}`)
	}
	startScheme(protocol: string) {
		return this.exec(`adb shell am start --activity-single-top -a android.intent.action.VIEW -d "${protocol}"`)
	}
	startScript(filename: string) {
		// cspell: disable next line
		const { stdout: mCurrentFocus} = this.exec(`adb shell dumpsys window`)
		const currentActivity = mCurrentFocus.match(/u\d+\ ([\S\s]+[^\}])/)?.[1]

		const { error } = this.startScheme(`zdjl://clientcall/zdOpenScript?run=1'&'filePath=${filename}`)
		if (error) {
			console.error(new Error(error))
		}

		currentActivity && this.exec(`adb shell monkey -p ${currentActivity.split('/')[0]} -c android.intent.category.LAUNCHER 1`)
	}
}

export default Device
