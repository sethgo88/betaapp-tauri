import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronDown, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { ClimbImageGallery } from "@/components/molecules/ClimbImageGallery";
import {
	useAddBurn,
	useBurns,
	useDeleteBurn,
	useUpdateBurn,
} from "@/features/burns/burns.queries";
import { useClimb, useDeleteClimb } from "@/features/climbs/climbs.queries";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { useRoute } from "@/features/routes/routes.queries";
import { cn } from "@/lib/cn";
import { buildLocationString } from "@/utils/build-location-string";

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
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);
	const [movesOpen, setMovesOpen] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [burnsOpen, setBurnsOpen] = useState(false);
	const [showAddBurn, setShowAddBurn] = useState(false);
	const [addDate, setAddDate] = useState(() =>
		new Date().toISOString().slice(0, 10),
	);
	const [addNotes, setAddNotes] = useState("");
	const [editingBurnId, setEditingBurnId] = useState<string | null>(null);
	const [editDate, setEditDate] = useState("");
	const [editNotes, setEditNotes] = useState("");

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

	let moves: { id: string; text: string }[] = [];
	try {
		moves = JSON.parse(climb.moves);
	} catch {
		moves = [];
	}

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

			{/* Burns section */}

			{confirmDelete ? (
				<div className="flex gap-2">
					<Button variant="outlined" onClick={() => setConfirmDelete(false)}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							deleteClimb.mutate(climb.id, {
								onSuccess: () => navigate({ to: "/" }),
							});
						}}
						disabled={deleteClimb.isPending}
					>
						Confirm Delete
					</Button>
				</div>
			) : (
				<Button variant="outlined" onClick={() => setConfirmDelete(true)}>
					Delete
				</Button>
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
						<button
							type="button"
							className="flex items-center gap-1 text-sm text-accent-primary self-start"
							onClick={() => {
								setShowAddBurn(!showAddBurn);
								setAddDate(new Date().toISOString().slice(0, 10));
								setAddNotes("");
							}}
						>
							<Plus size={16} />
							Add burn
						</button>

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
												},
											},
											{
												onSuccess: () => {
													setShowAddBurn(false);
													setAddDate(new Date().toISOString().slice(0, 10));
													setAddNotes("");
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
													<p className="text-sm font-semibold">{burn.date}</p>
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
														}}
													>
														<Pencil size={16} />
													</button>
													<button
														type="button"
														className="text-text-secondary"
														onClick={() => deleteBurn.mutate(burn.id)}
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

			<div className="rounded-md bg-surface-card">
				<button
					type="button"
					className="flex items-center gap-2 w-full px-3 pt-3 pb-2 text-sm text-text-secondary"
					onClick={() => setMovesOpen(!movesOpen)}
				>
					<span>Moves ({moves.length})</span>
					<ChevronDown
						size={16}
						className={cn("transition-transform", movesOpen && "rotate-180")}
					/>
				</button>
				{movesOpen && moves.length > 0 && (
					<ul className="flex flex-col gap-1 px-3 pb-3">
						{moves.map((move, i) => (
							<li
								key={move.id}
								className="border-l border-text-primary pl-2 text-sm"
							>
								{i + 1}. {move.text}
							</li>
						))}
					</ul>
				)}
				{movesOpen && moves.length === 0 && (
					<p className="text-sm text-text-secondary px-3 pb-3">
						No moves logged yet.
					</p>
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
