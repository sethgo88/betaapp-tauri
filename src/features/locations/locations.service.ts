import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Country, Region } from "./locations.schema";

export async function fetchCountries(): Promise<Country[]> {
	const db = await getDb();
	return db.select<Country[]>(
		"SELECT * FROM countries_cache ORDER BY sort_order ASC",
	);
}

export async function fetchRegions(countryId: string): Promise<Region[]> {
	const db = await getDb();
	return db.select<Region[]>(
		"SELECT * FROM regions_cache WHERE country_id = ? ORDER BY sort_order ASC",
		[countryId],
	);
}

export async function pullCountries(): Promise<void> {
	const { data, error } = await supabase.from("countries").select("*");
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	await db.execute("DELETE FROM countries_cache");
	for (const row of data as Country[]) {
		await db.execute(
			`INSERT INTO countries_cache (id, name, code, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
			[row.id, row.name, row.code, row.sort_order, row.created_at],
		);
	}
}

export async function pullRegions(): Promise<void> {
	const { data, error } = await supabase.from("regions").select("*");
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	await db.execute("DELETE FROM regions_cache");
	for (const row of data as Region[]) {
		await db.execute(
			`INSERT INTO regions_cache (id, country_id, name, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
			[row.id, row.country_id, row.name, row.sort_order, row.created_at],
		);
	}
}
