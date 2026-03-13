// Stub for @tauri-apps/plugin-sql in test environments.
// Tests inject a real adapter via setDb() instead of using this.
const Database = {
	load: async () => {
		throw new Error(
			"@tauri-apps/plugin-sql is not available in tests — call setDb() before getDb()",
		);
	},
};

export default Database;
