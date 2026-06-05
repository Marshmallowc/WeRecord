'use client'

import React from 'react'

interface ThoughtLoaderProps {
  message: string
}

export default function ThoughtLoader({ message }: ThoughtLoaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
      <style>{`
        @keyframes dot-morph-1 {
          0%, 15% {
            transform: translate3d(1px, 11px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          23%, 37% {
            transform: translate3d(1px, 1px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          45%, 57% {
            transform: translate3d(0px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          63% {
            transform: translate3d(0px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          67% {
            transform: translate3d(0px, 2px, 0) scale(1.15);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          71% {
            transform: translate3d(0px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          75% {
            transform: translate3d(0px, 10px, 0) scale(0.85);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          79% {
            transform: translate3d(0px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          83% {
            transform: translate3d(0px, 2px, 0) scale(1.15);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          87% {
            transform: translate3d(0px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          95%, 100% {
            transform: translate3d(1px, 11px, 0) scale(1);
          }
        }

        @keyframes dot-morph-2 {
          0%, 17% {
            transform: translate3d(6px, 1px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          25%, 39% {
            transform: translate3d(6px, 11px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          47%, 59% {
            transform: translate3d(6px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          65% {
            transform: translate3d(6px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          69% {
            transform: translate3d(6px, 2px, 0) scale(1.15);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          73% {
            transform: translate3d(6px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          77% {
            transform: translate3d(6px, 10px, 0) scale(0.85);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          81% {
            transform: translate3d(6px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          85% {
            transform: translate3d(6px, 2px, 0) scale(1.15);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          89% {
            transform: translate3d(6px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          95%, 100% {
            transform: translate3d(6px, 1px, 0) scale(1);
          }
        }

        @keyframes dot-morph-3 {
          0%, 19% {
            transform: translate3d(11px, 11px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          27%, 41% {
            transform: translate3d(11px, 1px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          49%, 61% {
            transform: translate3d(12px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          67% {
            transform: translate3d(12px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          71% {
            transform: translate3d(12px, 2px, 0) scale(1.15);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          75% {
            transform: translate3d(12px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          79% {
            transform: translate3d(12px, 10px, 0) scale(0.85);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          83% {
            transform: translate3d(12px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          87% {
            transform: translate3d(12px, 2px, 0) scale(1.15);
            animation-timing-function: cubic-bezier(0.445, 0.05, 0.55, 0.95);
          }
          90% {
            transform: translate3d(12px, 6px, 0) scale(1);
            animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          95%, 100% {
            transform: translate3d(11px, 11px, 0) scale(1);
          }
        }

        .thought-loader-container {
          position: relative;
          width: 16px;
          height: 16px;
          display: inline-block;
          flex-shrink: 0;
        }

        .thought-loader-dot {
          position: absolute;
          width: 4px;
          height: 4px;
          background-color: var(--text-secondary, #5c5550);
          border-radius: 50%;
          top: 0;
          left: 0;
          will-change: transform;
        }

        .thought-loader-dot-1 {
          animation: dot-morph-1 5s linear infinite;
        }

        .thought-loader-dot-2 {
          animation: dot-morph-2 5s linear infinite;
        }

        .thought-loader-dot-3 {
          animation: dot-morph-3 5s linear infinite;
        }
      `}</style>
      <div className="thought-loader-container">
        <div className="thought-loader-dot thought-loader-dot-1" />
        <div className="thought-loader-dot thought-loader-dot-2" />
        <div className="thought-loader-dot thought-loader-dot-3" />
      </div>
      <span className="pulse-text" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 400 }}>
        {message}
      </span>
    </div>
  )
}
