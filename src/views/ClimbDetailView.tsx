import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/atoms/Button";
import { FeelSlider } from "@/components/atoms/FeelSlider";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { ClimbImageGallery } from "@/components/molecules/ClimbImageGallery";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import {
	useAddBurn,
	useBurns,
	useDeleteBurn,
	useUpdateBurn,
} from "@/features/burns/burns.queries";
import {
	useClimb,
	useDeleteClimb,
	useUnlinkClimbFromRoute,
} from "@/features/climbs/climbs.queries";
import { parseBetas } from "@/features/climbs/climbs.schema";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { useRoute } from "@/features/routes/routes.queries";
import { cn } from "@/lib/cn";
import { buildLocationString } from "@/utils/build-location-string";

const FEEL_LABELS: Record<number, string> = {
	0: "Impossible",
	1: "Very far",
	2: "Far",
	3: "Getting closer",
	4: "Close",
	5: "It will go",
};

const ClimbDetailView = () => {
	const { climbId } = useParams({ from: "/climbs/$climbId" });
	const navigate = useNavigate();
	const { data: climb, isLoading } = useClimb(climbId);
	const { data: linkedRoute } = useRoute(climb?.route_id);
	const { data: burns } = useBurns(climbId);
	const addBurn = useAddBurn();
	const updateBurn = useUpdateBurn();
	const deleteBurn = useDeleteBurn();
	const deleteClimb = useDeleteClimb();
	const unlinkClimb = useUnlinkClimbFromRoute();
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);
	const [openBetaIds, setOpenBetaIds] = useState<Set<string>>(new Set());
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [pendingDeleteBurnId, setPendingDeleteBurnId] = useState<string | null>(
		null,
	);
	const [burnsOpen, setBurnsOpen] = useState(false);
	const [showAddBurn, setShowAddBurn] = useState(false);
	const [addDate, setAddDate] = useState(() =>
		new Date().toISOString().slice(0, 10),
	);
	const [addNotes, setAddNotes] = useState("");
	const [addFeel, setAddFeel] = useState<number | null>(null);
	const [editingBurnId, setEditingBurnId] = useState<string | null>(null);
	const [editDate, setEditDate] = useState("");
	const [editNotes, setEditNotes] = useState("");
	const [editFeel, setEditFeel] = useState<number | null>(null);

	useEffect(() => {
		setSelectedClimbId(climbId);
		return () => setSelectedClimbId(null);
	}, [climbId, setSelectedClimbId]);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!climb) {
		return (
			<p className="text-text-secondary text-center pt-12">Climb not found.</p>
		);
	}

	const betas = parseBetas(climb.moves);

	const toggleBeta = (id: string) => {
		setOpenBetaIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const location = buildLocationString([
		climb.country,
		climb.area,
		climb.sub_area,
		climb.crag,
		climb.wall,
	]);

	return (
		<div className="flex flex-col gap-4">
			<ClimbImageGallery climbId={climbId} />

			<div className="flex items-start justify-between">
				<div>
					{climb.route_id ? (
						<button
							type="button"
							className="flex items-center gap-1.5 text-left"
							onClick={() =>
								navigate({
									to: "/routes/$routeId",
									params: { routeId: climb.route_id as string },
								})
							}
						>
							<h1 className="text-2xl font-display font-bold">{climb.name}</h1>
							<ExternalLink
								size={16}
								className="text-text-secondary shrink-0 mt-1"
							/>
						</button>
					) : (
						<h1 className="text-2xl font-display font-bold">{climb.name}</h1>
					)}
					{location && (
						<p className="text-sm text-text-secondary">{location}</p>
					)}
				</div>
				<div className="text-right flex flex-col items-end gap-0.5">
					<div className="flex items-baseline gap-1.5">
						<span className="text-xs text-text-secondary">Personal</span>
						<span className="text-lg font-display font-semibold">
							{climb.grade}
						</span>
					</div>
					{linkedRoute && (
						<div className="flex items-baseline gap-1.5">
							<span className="text-xs text-text-secondary">Official</span>
							<span className="text-lg font-display font-semibold">
								{linkedRoute.grade}
							</span>
						</div>
					)}
					<p className="text-xs text-text-secondary capitalize">
						{climb.route_type}
					</p>
				</div>
			</div>

			<div className="flex gap-2 flex-wrap">
				<span
					className={cn(
						"rounded-full px-3 py-1 text-sm capitalize",
						climb.sent_status === "sent" &&
							"bg-badge-sent-bg text-badge-sent-text",
						climb.sent_status === "todo" &&
							"bg-badge-todo-bg text-badge-todo-text",
						climb.sent_status !== "sent" &&
							climb.sent_status !== "todo" &&
							"bg-surface-card",
					)}
				>
					{climb.sent_status}
				</span>
			</div>

			<Button
				onClick={() =>
					navigate({
						to: "/climbs/$climbId/edit",
						params: { climbId: climb.id },
					})
				}
			>
				Edit
			</Button>

			{climb.route_id && (
				<Button
					variant="outlined"
					disabled={unlinkClimb.isPending}
					onClick={() => unlinkClimb.mutate(climb.id)}
				>
					{unlinkClimb.isPending ? "Unlinking…" : "Unlink from route"}
				</Button>
			)}

			{/* Burns section */}

			<Button variant="outlined" onClick={() => setConfirmDelete(true)}>
				Delete
			</Button>

			<ConfirmDeleteDialog
				isOpen={confirmDelete}
				title="Delete climb"
				message={`Are you sure you want to delete "${climb.name}"? This can't be undone.`}
				onConfirm={() => {
					deleteClimb.mutate(climb.id, {
						onSuccess: () => navigate({ to: "/" }),
					});
					setConfirmDelete(false);
				}}
				onCancel={() => setConfirmDelete(false)}
			/>

			<ConfirmDeleteDialog
				isOpen={pendingDeleteBurnId !== null}
				title="Delete burn"
				message="Are you sure you want to delete this burn?"
				onConfirm={() => {
					if (pendingDeleteBurnId) deleteBurn.mutate(pendingDeleteBurnId);
					setPendingDeleteBurnId(null);
				}}
				onCancel={() => setPendingDeleteBurnId(null)}
			/>

			{betas.length === 0 ? (
				<div className="rounded-md bg-surface-card px-3 py-3">
					<p className="text-sm text-text-secondary">No betas logged yet.</p>
				</div>
			) : (
				betas.map((beta) => (
					<div key={beta.id} className="rounded-md bg-surface-card">
						<button
							type="button"
							className="flex items-center justify-between w-full p-3 text-sm text-text-secondary"
							onClick={() => toggleBeta(beta.id)}
						>
							<span>
								{beta.title} ({beta.moves.length})
							</span>
							<ChevronDown
								size={16}
								className={cn(
									"transition-transform",
									openBetaIds.has(beta.id) && "rotate-180",
								)}
							/>
						</button>
						{openBetaIds.has(beta.id) &&
							(beta.moves.length > 0 ? (
								<ul className="flex flex-col gap-1 px-3 pb-3">
									{beta.moves.map((move, i) => (
										<li
											key={move.id}
											className="border-l border-text-primary pl-2 text-sm"
										>
											{i + 1}. {move.text}
										</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-text-secondary px-3 pb-3">
									No moves logged yet.
								</p>
							))}
					</div>
				))
			)}

			<div className="rounded-md bg-surface-card">
				<button
					type="button"
					className="flex items-center justify-between w-full p-3 text-sm text-text-secondary"
					onClick={() => setBurnsOpen(!burnsOpen)}
				>
					<span>Burns ({burns?.length ?? 0})</span>
					<ChevronDown
						size={16}
						className={cn("transition-transform", burnsOpen && "rotate-180")}
					/>
				</button>
				{burnsOpen && (
					<div className="flex flex-col gap-2 px-3 pb-3">
						<Button
							size="small"
							variant="outlined"
							className="flex items-center gap-1 self-start"
							onClick={() => {
								setShowAddBurn(!showAddBurn);
								setAddDate(new Date().toISOString().slice(0, 10));
								setAddNotes("");
							}}
						>
							<Plus size={14} />
							Add burn
						</Button>

						{showAddBurn && (
							<div className="rounded-[var(--radius-md)] bg-surface-input p-3 flex flex-col gap-2">
								<Input
									type="date"
									value={addDate}
									onChange={(e) => setAddDate(e.target.value)}
								/>
								<Input
									placeholder="Notes (optional)"
									value={addNotes}
									onChange={(e) => setAddNotes(e.target.value)}
								/>
								<FeelSlider value={addFeel} onChange={setAddFeel} />
								<Button
									size="small"
									disabled={!addDate || addBurn.isPending}
									onClick={() => {
										addBurn.mutate(
											{
												climbId,
												data: {
													date: addDate,
													notes: addNotes || undefined,
													feel: addFeel,
												},
											},
											{
												onSuccess: () => {
													setShowAddBurn(false);
													setAddDate(new Date().toISOString().slice(0, 10));
													setAddNotes("");
													setAddFeel(null);
												},
											},
										);
									}}
								>
									Save
								</Button>
							</div>
						)}

						{burns && burns.length > 0 ? (
							<ul className="flex flex-col gap-2">
								{burns.map((burn) => (
									<li
										key={burn.id}
										className="border-l border-text-primary pl-2"
									>
										{editingBurnId === burn.id ? (
											<div className="flex flex-col gap-2">
												<Input
													type="date"
													value={editDate}
													onChange={(e) => setEditDate(e.target.value)}
												/>
												<Input
													placeholder="Notes (optional)"
													value={editNotes}
													onChange={(e) => setEditNotes(e.target.value)}
												/>
												<FeelSlider value={editFeel} onChange={setEditFeel} />
												<div className="flex gap-2">
													<Button
														size="small"
														disabled={!editDate || updateBurn.isPending}
														onClick={() => {
															updateBurn.mutate(
																{
																	id: burn.id,
																	data: {
																		date: editDate,
																		notes: editNotes || undefined,
																		feel: editFeel,
																	},
																},
																{
																	onSuccess: () => setEditingBurnId(null),
																},
															);
														}}
													>
														Save
													</Button>
													<Button
														size="small"
														variant="outlined"
														onClick={() => setEditingBurnId(null)}
													>
														Cancel
													</Button>
												</div>
											</div>
										) : (
											<div className="flex items-center justify-between">
												<div>
													<p className="text-sm font-semibold">{formatDate(burn.date)}</p>
													{burn.feel != null && (
														<p className="text-xs text-accent-primary">
															{FEEL_LABELS[burn.feel]}
														</p>
													)}
													{burn.notes && (
														<p className="text-sm text-text-secondary">
															{burn.notes}
														</p>
													)}
												</div>
												<div className="flex items-center gap-3">
													<button
														type="button"
														className="text-text-secondary"
														onClick={() => {
															setEditingBurnId(burn.id);
															setEditDate(burn.date);
															setEditNotes(burn.notes ?? "");
															setEditFeel(burn.feel ?? null);
														}}
													>
														<Pencil size={16} />
													</button>
													<button
														type="button"
														className="text-text-secondary"
														onClick={() => setPendingDeleteBurnId(burn.id)}
													>
														<Trash2 size={16} />
													</button>
												</div>
											</div>
										)}
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-text-secondary">
								No burns logged yet.
							</p>
						)}
					</div>
				)}
			</div>

			{climb.link && (
				<a
					href={climb.link}
					target="_blank"
					rel="noreferrer"
					className="text-accent-primary text-sm underline"
				>
					{climb.link}
				</a>
			)}
		</div>
	);
};

export default ClimbDetailView;
