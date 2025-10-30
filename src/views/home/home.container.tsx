import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { useEffect, useState } from "react";
import PageWrapper from "../../components/page-wrapper/page-wrapper";
import type { ClimbType } from "../../types/climb";

const HomeContainer = () => {
	const [isLoadingClimbs, setIsLoadingClimbs] = useState(true);
	const [Climbs, setClimbs] = useState<ClimbType[]>([]);
	const [error, setError] = useState<string>("");

	async function getClimbs() {
		const response = await invoke("get_climbs");
		setClimbs(response as ClimbType[]);
		setIsLoadingClimbs(false);
	}

	useEffect(() => {
		getClimbs();
	}, []);

	return (
		<PageWrapper>
			<div>Home Page</div>
			{isLoadingClimbs ? (
				<div>Loading climbs...</div>
			) : (
				<ul>
					{Climbs.map((climb, index) => (
						<li key={index}>
							{climb.name} - {climb.type} - {climb.grade}
						</li>
					))}
				</ul>
			)}
			{error && <div className="text-red-500">{error}</div>}
		</PageWrapper>
	);
};

export default HomeContainer;
