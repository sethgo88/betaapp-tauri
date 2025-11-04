import { invoke } from "@tauri-apps/api/core";
import { useContext, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import NavContext from "@/components/navigation/nav-context";
import { buildLocationString } from "@/utils/build-location-string";
import { ListItem } from "@/views/home/components/list-item";
import PageWrapper from "../../components/page-wrapper/page-wrapper";
import type { ClimbType } from "../../types/climb";

const HomeContainer = () => {
	const [isLoadingClimbs, setIsLoadingClimbs] = useState(true);
	const [Climbs, setClimbs] = useState<ClimbType[]>([]);
	const [error, setError] = useState<string>("");
	const { setAppState, setCurrentClimb } = useContext(NavContext);

	async function getClimbs() {
		const response = await invoke("get_climbs");
		if (!response) {
			setError("Failed to get climbs - no response from backend");
			setIsLoadingClimbs(false);
			return;
		}
		setClimbs(response as ClimbType[]);
		setIsLoadingClimbs(false);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: <run on first render>
	useEffect(() => {
		getClimbs();
	}, []);

	const goToClimb = (climb: ClimbType) => () => {
		setCurrentClimb(climb);
		setAppState("add");
	};

	return (
		<PageWrapper>
			{isLoadingClimbs ? (
				<div>Loading climbs...</div>
			) : (
				<ul className="flex flex-col gap-3">
					{Climbs.map((climb) => (
						<ListItem
							key={`${climb.id}-${climb.name}`}
							id={climb.id}
							className={twMerge(
								climb.sent_status === "Sent" && "bg-emerald-900/20",
							)}
							onClick={goToClimb(climb)}
						>
							<button
								type="button"
								className="flex flex-col flex-1 justify-between"
							>
								<div className="flex flex-row items-start justify-between leading-none w-full">
									<span className="font-bold">{climb.name}</span>
									<span className="text-sm">{climb.grade}</span>
								</div>
								<div className="text-xs text-current/70">
									{buildLocationString([
										climb.country,
										climb.area,
										climb.sub_area,
									])}
								</div>
							</button>
						</ListItem>
					))}
				</ul>
			)}
			{error && <div className="text-red-500">{error}</div>}
		</PageWrapper>
	);
};

export default HomeContainer;
