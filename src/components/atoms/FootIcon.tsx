/**
 * FootIcon — climbing shoe silhouette, converted from path42.svg.
 * API mirrors Lucide icons: size, color, strokeWidth, className, style.
 *
 * The original viewBox is 113.32 × 80.64 (wider than tall). We render it
 * into a square bounding box using preserveAspectRatio so it behaves the same
 * as any other square icon.
 *
 * strokeWidth uses vectorEffect="non-scaling-stroke" so the line weight stays
 * consistent in screen pixels at any rendered size.
 */

import type { SVGProps } from "react";

interface FootIconProps extends SVGProps<SVGSVGElement> {
	size?: number;
	color?: string;
	strokeWidth?: number;
}

export const FootIcon = ({
	size = 24,
	color = "currentColor",
	strokeWidth = 1,
	className,
	style,
	...props
}: FootIconProps) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 113.32044 80.644562"
		preserveAspectRatio="xMidYMid meet"
		fill="none"
		stroke={color}
		strokeWidth={strokeWidth}
		strokeLinejoin="bevel"
		strokeLinecap="round"
		aria-label="Foot"
		role="img"
		className={className}
		style={style}
		{...props}
	>
		<path
			vectorEffect="non-scaling-stroke"
			d="M 34.243483,37.113439 C 32.812763,32.049269 32.648493,26.262602 28.606936,22.385413 24.698538,16.723858 19.469798,11.630955 13.242522,8.5665467 M 4.1510413,21.294449 c 1.373912,4.276569 5.518275,6.951151 8.9717227,9.452779 7.567384,4.838139 16.677988,6.595813 25.555639,6.315753 7.78792,0.07562 15.56232,1.980933 22.96445,4.544095 6.39329,2.469911 11.70385,6.155326 14.96935,10.979591 m -8.40587,-25.118436 c 3.6692,2.207194 8.10879,7.197331 11.22964,10.056931 4.16128,3.061193 8.26866,8.10591 13.97173,7.258058 2.05214,-0.584665 3.75416,-1.939774 5.65721,-2.85135 m -48.0933,-28.910569 c 2.92809,2.727483 6.24383,4.962421 8.72761,7.72765 m 11.76524,-10.502293 c -2.57251,-0.3013813 -13.60969,12.11123 -13.71472,14.750854 -0.0887,2.228326 5.62614,5.892272 7.2738,6.056165 1.04787,0.104232 1.95238,-2.845667 3.65139,-4.619209 2.97796,-3.108587 5.52415,-6.548827 8.10452,-7.919645 M 28.152265,1.7479977 C 12.911209,0.48775763 -4.3865817,26.720962 3.8580423,41.737986 c 3.23266,5.888071 17.5070057,11.349229 35.8082607,9.695873 15.25117,-1.377807 45.73487,13.01963 66.347067,27.828448 15.86029,-18.246584 -6.214167,-36.048663 -13.638447,-43.807392 -4.02216,-4.203346 -12.78063,-13.0829 -16.36806,-16.471464 0.87328,-0.651194 2.59113,-1.71812 2.23258,-3.007939 -0.33516,-1.205734 -3.72761,-5.671286 -6.98879,-5.803601 -1.47193,-0.05972 -1.66801,2.034329 -3.32049,0.751247 -3.01798,-2.3433063 -6.86754,-6.8437623 -8.10835,-7.5302333 -2.89564,4.335963 -5.4153,8.1591953 -9.74847,10.5621183 -9.70417,6.969554 -21.49318,-1.771922 -21.921078,-12.2070453 z"
		/>
	</svg>
);
