declare namespace Cloudflare {
	interface GlobalProps {
		mainModule: typeof import("./.open-next/worker");
	}
	interface Env {
		ASSETS: Fetcher;
	}
}
interface CloudflareEnv extends Cloudflare.Env {}
