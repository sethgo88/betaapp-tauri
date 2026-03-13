import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useCrag,
	useSubmitWall,
	useUpdateLocationDescription,
	useWalls,
} from "@/features/locations/locations.queries";

// ── Inline name form ──────────────────────────────────────────────────────────

const InlineAddForm = ({
	placeholder,
	pending,
	onSubmit,
	onCancel,
}: {
	placeholder: string;
	pending: boolean;
	onSubmit: (name: string) => void;
	onCancel: () => void;
}) => {
	const [name, setName] = useState("");

	return (
		<div className="flex gap-2 mt-2">
			<input
				type="text"
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder={placeholder}
				className="flex-1 text-sm bg-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 outline-none"
				// biome-ignore lint/a11y/noAutofocus: intentional — form appears on user tap
				autoFocus
			/>
			<button
				type="button"
				disabled={!name.trim() || pending}
				onClick={() => onSubmit(name.trim())}
				className="text-sm px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
			>
				{pending ? "…" : "Add"}
			</button>
			<button
				type="button"
				onClick={onCancel}
				className="text-sm px-3 py-2 rounded-lg bg-stone-600 hover:bg-stone-500"
			>
				Cancel
			</button>
		</div>
	);
};

// ── Crag view ─────────────────────────────────────────────────────────────────

const CragView = () => {
	const { cragId } = useParams({ from: "/crags/$cragId" });
	const navigate = useNavigate();
	const { data: crag, isLoading } = useCrag(cragId);
	const { data: walls = [] } = useWalls(cragId);
	const submitWall = useSubmitWall();
	const updateDescription = useUpdateLocationDescription();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const [showWallForm, setShowWallForm] = useState(false);

	const handleAddWall = async (name: string) => {
		await submitWall.mutateAsync({ crag_id: cragId, name });
		setShowWallForm(false);
	};

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-stone-400 text-sm text-left"
				onClick={() => {
					if (crag?.sub_region_id) {
						navigate({
							to: "/sub-regions/$subRegionId",
							params: { subRegionId: crag.sub_region_id },
						});
					}
				}}
			>
				← Back to area
			</button>

			{crag && (
				<>
					<h1 className="text-xl font-bold">{crag.name}</h1>
					<EditableDescription
						description={crag.description}
						isAdmin={isAdmin}
						onSave={async (description) => {
							await updateDescription.mutateAsync({
								table: "crags",
								id: cragId,
								description,
							});
						}}
					/>
				</>
			)}

			{walls.length === 0 && !showWallForm && (
				<p className="text-stone-400 text-sm">No walls in this crag yet.</p>
			)}

			{walls.map((wall) => (
				<button
					key={wall.id}
					type="button"
					className="rounded-lg bg-stone-800 p-4 text-left font-medium flex items-center justify-between"
					onClick={() =>
						wall.status === "pending"
							? undefined
							: navigate({
									to: "/walls/$wallId",
									params: { wallId: wall.id },
								})
					}
				>
					<span>{wall.name}</span>
					{wall.status === "pending" && (
						<span className="text-xs text-amber-400">pending</span>
					)}
				</button>
			))}

			{showWallForm ? (
				<InlineAddForm
					placeholder="Wall name"
					pending={submitWall.isPending}
					onSubmit={handleAddWall}
					onCancel={() => setShowWallForm(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setShowWallForm(true)}
					className="text-sm text-stone-400 hover:text-stone-200 text-left"
				>
					+ Add wall
				</button>
			)}
		</div>
	);
};

export default CragView;
