"use client";

import React, { useRef, useState, MouseEvent } from "react";
import { cn } from "@shipora/ui";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glareColor?: string;
  maxTilt?: number;
  scale?: number;
  children: React.ReactNode;
}

export function TiltCard({
  glareColor = "rgba(255, 255, 255, 0.05)",
  maxTilt = 6,
  scale = 1.01,
  className,
  children,
  ...props
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    const rotX = -((y - rect.height / 2) / (rect.height / 2)) * maxTilt;
    const rotY = ((x - rect.width / 2) / (rect.width / 2)) * maxTilt;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePosition({ x: percentX, y: percentY, opacity: 1 });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
    setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: "1000px",
      }}
      className={cn("relative transition-transform duration-200 ease-out", className)}
      {...props}
    >
      <div
        style={{
          transform: isHovered
            ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`
            : "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transformStyle: "preserve-3d",
          transition: isHovered ? "transform 0.1s ease-out" : "transform 0.4s ease-out",
        }}
        className="relative w-full h-full rounded-lg border border-white/[0.08] bg-[#09090b] overflow-hidden shadow-lg"
      >
        {/* Dynamic Glare / Specular highlight reflection following mouse */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-10"
          style={{
            opacity: glarePosition.opacity,
            background: `radial-gradient(circle 320px at ${glarePosition.x}% ${glarePosition.y}%, ${glareColor}, transparent 80%)`,
          }}
        />

        {/* Top subtle 1px border highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* Content container */}
        <div className="relative z-0 h-full p-6 sm:p-7 flex flex-col justify-between">
          {children}
        </div>
      </div>
    </div>
  );
}
