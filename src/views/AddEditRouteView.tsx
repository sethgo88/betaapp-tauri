import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import {
	LocationDrillDown,
	type LocationSelection,
} from "@/components/molecules/LocationDrillDown";
import { Sheet } from "@/components/molecules/Sheet";
import { useAuthStore } from "@/features/auth/auth.store";
import { useGrades } from "@/features/grades/grades.queries";
import {
	useCrag,
	useRegion,
	useSubRegion,
	useWall,
} from "@/features/locations/locations.queries";
import {
	useAddRoute,
	useEditRoute,
	useRoute,
} from "@/features/routes/routes.queries";
import { RouteSubmitSchema } from "@/features/routes/routes.schema";
import { useUiStore } from "@/stores/ui.store";

// ── Edit mode: resolve the full location chain from a wall_id ─────────────────

function useLocationChain(wallId: string | null | undefined) {
	const { data: wall } = useWall(wallId ?? null);
	const { data: crag } = useCrag(wall?.crag_id ?? null);
	const { data: subRegion } = useSubRegion(crag?.sub_region_id ?? null);
	const { data: region } = useRegion(subRegion?.region_id ?? null);

	if (!wall || !crag || !subRegion || !region) return null;

	return {
		wallId: wall.id,
		cragId: crag.id,
		subRegionId: subRegion.id,
		regionId: region.id,
		countryId: region.country_id,
	};
}

// ── Main view ─────────────────────────────────────────────────────────────────

interface AddEditRouteViewProps {
	routeId?: string;
}

const AddEditRouteView = ({ routeId }: AddEditRouteViewProps) => {
	const router = useRouter();
	const addToast = useUiStore((s) => s.addToast);
	const user = useAuthStore((s) => s.user);
	const isAdmin = user?.role === "admin";
	const isEditMode = !!routeId;

	// Route data (edit mode)
	const { data: existingRoute, isLoading: routeLoading } = useRoute(
		routeId ?? null,
	);
	const locationChain = useLocationChain(existingRoute?.wall_id);

	// Form state
	const [name, setName] = useState("");
	const [routeType, setRouteType] = useState<"sport" | "boulder">("sport");
	const [grade, setGrade] = useState("");
	const [description, setDescription] = useState("");
	const [selection, setSelection] = useState<LocationSelection>({
		countryId: null,
		regionId: null,
		subRegionId: null,
		cragId: null,
		wallId: null,
		wall: null,
	});

	// Sheet state — pending is internal to the sheet; only committed on Save
	const [locationSheetOpen, setLocationSheetOpen] = useState(false);
	const [sheetKey, setSheetKey] = useState(0);
	const [pendingSelection, setPendingSelection] =
		useState<LocationSelection>(selection);

	const handleSheetOpen = () => {
		// In edit mode, seed from locationChain on first open (before user has
		// confirmed anything). After a Save, selection carries the committed value.
		if (isEditMode && !selection.wallId && locationChain) {
			setPendingSelection({
				countryId: locationChain.countryId,
				regionId: locationChain.regionId,
				subRegionId: locationChain.subRegionId,
				cragId: locationChain.cragId,
				wallId: locationChain.wallId,
				wall: null,
			});
		} else {
			setPendingSelection(selection);
		}
		setSheetKey((k) => k + 1);
		setLocationSheetOpen(true);
	};

	const handleSheetSave = () => {
		setSelection(pendingSelection);
		setLocationSheetOpen(false);
	};

	const handlePendingChange = useCallback((sel: LocationSelection) => {
		setPendingSelection(sel);
	}, []);

	const { data: grades = [] } = useGrades(routeType);
	const { mutateAsync: addRoute, isPending: adding } = useAddRoute();
	const { mutateAsync: editRoute, isPending: editing } = useEditRoute();

	// Populate form fields when editing
	useEffect(() => {
		if (existingRoute) {
			setName(existingRoute.name);
			setRouteType(existingRoute.route_type);
			setGrade(existingRoute.grade);
			setDescription(existingRoute.description ?? "");
		}
	}, [existingRoute]);

	const canSubmit = !!selection.wallId && name.trim().length > 0;

	const handleSubmit = async () => {
		const resolvedGrade = grade || (grades.length > 0 ? grades[0].grade : "");
		const parsed = RouteSubmitSchema.safeParse({
			wall_id: selection.wallId,
			name: name.trim(),
			grade: resolvedGrade,
			route_type: routeType,
			description: description.trim() || undefined,
		});

		if (!parsed.success) {
			const messages = parsed.error.issues.map((i) => i.message).join("\n");
			addToast({ message: messages, type: "error" });
			return;
		}

		try {
			if (isEditMode && routeId) {
				await editRoute({
					id: routeId,
					values: {
						wall_id: parsed.data.wall_id,
						name: parsed.data.name,
						grade: parsed.data.grade,
						route_type: parsed.data.route_type,
						description: parsed.data.description,
					},
				});
				addToast({ message: "Route updated", type: "success" });
			} else {
				await addRoute({
					values: parsed.data,
					userId: user?.id ?? "",
					isAdmin,
				});
				addToast({
					message: isAdmin ? "Route added" : "Route submitted for review",
					type: "success",
				});
			}
			router.history.back();
		} catch {
			addToast({
				message: isEditMode ? "Failed to update route" : "Failed to add route",
				type: "error",
			});
		}
	};

	if (isEditMode && routeLoading) {
		return (
			<div className="flex justify-center pt-8">
				<Spinner />
			</div>
		);
	}

	const title = isEditMode ? "Edit Route" : "Add Route";
	const submitLabel = isEditMode
		? "Save changes"
		: isAdmin
			? "Add route"
			: "Submit for review";

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-lg font-display font-semibold">{title}</h1>

			{/* Location — tappable summary opens full-screen sheet */}
			<button
				type="button"
				onClick={handleSheetOpen}
				className="rounded-lg bg-surface-card p-4 flex items-center justify-between text-left w-full"
			>
				<div className="flex flex-col gap-0.5">
					<span className="text-xs text-text-secondary">Location</span>
					<span
						className={
							selection.wallId
								? "text-sm text-text-primary"
								: "text-sm text-text-tertiary"
						}
					>
						{selection.wallId
							? (selection.wall?.name ?? "Wall selected")
							: "Tap to select location…"}
					</span>
				</div>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-text-tertiary shrink-0"
					aria-hidden="true"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</button>

			<Sheet
				isOpen={locationSheetOpen}
				onClose={() => setLocationSheetOpen(false)}
				title="Select Location"
				action={
					pendingSelection.wallId ? (
						<button
							type="button"
							onClick={handleSheetSave}
							className="text-sm font-medium text-accent-primary"
						>
							Save
						</button>
					) : undefined
				}
			>
				<LocationDrillDown
					key={sheetKey}
					onChange={handlePendingChange}
					stopAt="wall"
					initial={{
						countryId: pendingSelection.countryId ?? undefined,
						regionId: pendingSelection.regionId ?? undefined,
						subRegionId: pendingSelection.subRegionId ?? undefined,
						cragId: pendingSelection.cragId ?? undefined,
						wallId: pendingSelection.wallId ?? undefined,
					}}
					allowAdd={isAdmin}
				/>
			</Sheet>

			{/* Route fields */}
			<div className="flex flex-col gap-3">
				<Input
					placeholder="Route name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>

				<Select
					value={routeType}
					onChange={(e) => {
						const val = e.target.value as "sport" | "boulder";
						setRouteType(val);
						setGrade("");
					}}
				>
					<option value="sport">Sport</option>
					<option value="boulder">Boulder</option>
				</Select>

				<Select
					value={grade || (grades.length > 0 ? grades[0].grade : "")}
					onChange={(e) => setGrade(e.target.value)}
				>
					{grades.map((g) => (
						<option key={g.id} value={g.grade}>
							{g.grade}
						</option>
					))}
				</Select>

				<textarea
					placeholder="Description (optional)"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					rows={3}
					className="rounded-[var(--radius-lg)] bg-surface-input p-2.5 font-medium outline-0 w-full border border-border-input focus:border-accent-primary transition-colors resize-none text-text-primary"
				/>

				<Button
					type="button"
					onClick={handleSubmit}
					disabled={!canSubmit || adding || editing}
				>
					{adding || editing ? <Spinner size="sm" /> : submitLabel}
				</Button>
			</div>
		</div>
	);
};

export default AddEditRouteView;
