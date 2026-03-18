import { Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface VideoFrameCapturerProps {
	onCapture: (file: File) => void;
	onClose: () => void;
}

export const VideoFrameCapturer = ({
	onCapture,
	onClose,
}: VideoFrameCapturerProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const blobUrlRef = useRef<string | null>(null);

	const [videoReady, setVideoReady] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [isSaving, setIsSaving] = useState(false);

	// Open file picker immediately on mount
	useEffect(() => {
		fileInputRef.current?.click();
	}, []);

	// Revoke blob URL on unmount
	useEffect(() => {
		return () => {
			if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
		};
	}, []);

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
		const url = URL.createObjectURL(file);
		blobUrlRef.current = url;
		const video = videoRef.current;
		if (video) {
			video.src = url;
			video.load();
		}
		setVideoReady(false);
		setCurrentTime(0);
		setIsPlaying(false);
		e.target.value = "";
	}

	function handleLoadedMetadata() {
		const video = videoRef.current;
		if (!video) return;
		setDuration(video.duration);
		setVideoReady(true);
	}

	function handleTimeUpdate() {
		if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
	}

	function handlePlayPause() {
		const video = videoRef.current;
		if (!video) return;
		if (video.paused) {
			video.play();
			setIsPlaying(true);
		} else {
			video.pause();
			setIsPlaying(false);
		}
	}

	function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
		const t = Number(e.target.value);
		setCurrentTime(t);
		if (videoRef.current) videoRef.current.currentTime = t;
	}

	function handleSaveFrame() {
		const video = videoRef.current;
		if (!video || isSaving) return;
		setIsSaving(true);

		// Resize to max 1920px on the longest edge (matches resizeAndCompress)
		const MAX_PX = 1920;
		const scale = Math.min(
			1,
			MAX_PX / Math.max(video.videoWidth, video.videoHeight),
		);
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(video.videoWidth * scale);
		canvas.height = Math.round(video.videoHeight * scale);

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			setIsSaving(false);
			return;
		}
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		canvas.toBlob(
			(blob) => {
				setIsSaving(false);
				if (!blob) return;
				onCapture(new File([blob], "frame.jpg", { type: "image/jpeg" }));
			},
			"image/jpeg",
			0.8,
		);
	}

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, "0")}`;
	}

	return (
		<div className="fixed inset-0 z-50 bg-black flex flex-col">
			{/* Header */}
			<div
				className="flex items-center justify-between px-4 pb-2 shrink-0"
				style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
			>
				<button
					type="button"
					onClick={onClose}
					className="text-white"
					aria-label="Close"
				>
					<X size={24} />
				</button>
				<span className="text-white text-sm font-semibold">Capture frame</span>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="text-white/70 text-xs"
				>
					Change
				</button>
			</div>

			{/* Video area */}
			<div className="relative flex-1 flex items-center justify-center overflow-hidden">
				{/* biome-ignore lint/a11y/useMediaCaption: user's own video — no captions applicable */}
				<video
					ref={videoRef}
					className="max-w-full max-h-full object-contain"
					playsInline
					onLoadedMetadata={handleLoadedMetadata}
					onTimeUpdate={handleTimeUpdate}
					onEnded={() => setIsPlaying(false)}
				/>
				{!videoReady && (
					<p className="absolute text-white/40 text-sm">
						Pick a video to begin
					</p>
				)}
			</div>

			{/* Controls — only shown once a video is loaded */}
			{videoReady && (
				<div
					className="shrink-0 bg-surface-card px-4 pt-4 flex flex-col gap-3"
					style={{
						paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
					}}
				>
					{/* Seek bar */}
					<div className="flex items-center gap-2">
						<span className="text-xs text-text-tertiary tabular-nums w-8">
							{formatTime(currentTime)}
						</span>
						<input
							type="range"
							min={0}
							max={duration}
							step={0.033}
							value={currentTime}
							onChange={handleSeek}
							className="flex-1 accent-accent-primary"
						/>
						<span className="text-xs text-text-tertiary tabular-nums w-8 text-right">
							{formatTime(duration)}
						</span>
					</div>

					{/* Play/pause + save */}
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={handlePlayPause}
							className="w-10 h-10 rounded-full bg-surface-active flex items-center justify-center text-text-primary shrink-0"
							aria-label={isPlaying ? "Pause" : "Play"}
						>
							{isPlaying ? <Pause size={18} /> : <Play size={18} />}
						</button>
						<button
							type="button"
							onClick={handleSaveFrame}
							disabled={isSaving}
							className="flex-1 py-3 rounded-[var(--radius-md)] bg-accent-primary text-white font-semibold disabled:opacity-50"
						>
							{isSaving ? "Saving…" : "Save frame"}
						</button>
					</div>
				</div>
			)}

			{/* Hidden video file input */}
			<input
				ref={fileInputRef}
				type="file"
				accept="video/*"
				className="hidden"
				onChange={handleFileChange}
			/>
		</div>
	);
};
