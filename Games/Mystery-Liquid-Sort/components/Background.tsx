import React from 'react';
import { BackgroundConfig } from '../utils/backgrounds';

interface BackgroundProps {
    background: BackgroundConfig;
}

export const Background: React.FC<BackgroundProps> = ({ background }) => {
    if (background.type === 'gradient') {
        const { from, to, radial } = background.gradient!;
        
        return (
            <>
                {/* Base gradient */}
                <div 
                    className="absolute inset-0 z-0"
                    style={{
                        background: `linear-gradient(to bottom, ${from}, ${to})`
                    }}
                />
                {/* Radial gradient overlay */}
                {radial && (
                    <div 
                        className="absolute top-0 left-0 right-0 h-[60%] pointer-events-none z-0"
                        style={{
                            background: `radial-gradient(circle at 50% 0%, ${radial.color}, transparent 70%)`
                        }}
                    />
                )}
            </>
        );
    } else {
        // Image background
        return (
            <>
                {/* Background image */}
                <div 
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                    style={{
                        backgroundImage: `url(${background.imageUrl})`
                    }}
                />
                {/* Overlay for text readability */}
                {background.overlay && (
                    <div 
                        className="absolute inset-0 z-0"
                        style={{
                            backgroundColor: background.overlay
                        }}
                    />
                )}
            </>
        );
    }
};
