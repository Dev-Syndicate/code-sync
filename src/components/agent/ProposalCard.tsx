'use client'

// ProposalCard
// ────────────
// Renders a single EditProposal as a diff preview with Accept / Reject
// buttons. The "original" content is pulled live from the Y.Text at render
// time so the diff reflects the current state of the document, not a
// snapshot from when the proposal was produced.

import { useMemo } from 'react'
import type * as Y from 'yjs'
import { diffLines, type Change } from 'diff'
import type { EditProposal } from '@/types/agent'
import { lineColToOffset } from '@/lib/gemini/proposals'

interface Props {
  proposal: EditProposal
  ydoc: Y.Doc | null
  onAccept: (id: string) => void
  onReject: (id: string) => void
}

// Given the current file content and a proposal, compute the string that
// WOULD replace the targeted slice — i.e. what to compare against the
// current document when rendering a diff.
function computeCurrentAndProposed(
  current: string,
  proposal: EditProposal
): { original: string; proposed: string } {
  if (proposal.mode === 'replace_file') {
    return { original: current, proposed: proposal.newContent }
  }
  if (proposal.mode === 'replace_range' && proposal.range) {
    const start = lineColToOffset(
      current,
      proposal.range.startLine,
      proposal.range.startCol
    )
    const endRaw = lineColToOffset(
      current,
      proposal.range.endLine,
      proposal.range.endCol
    )
    const end = Math.max(start, endRaw)
    return {
      original: current.slice(start, end),
      proposed: proposal.newContent,
    }
  }
  return { original: current, proposed: current }
}

export function ProposalCard({
  proposal,
  ydoc,
  onAccept,
  onReject,
}: Props) {
  const currentContent = useMemo(() => {
    if (!ydoc) return ''
    try {
      return ydoc.getText(`file:${proposal.filePath}`).toString()
    } catch {
      return ''
    }
  }, [ydoc, proposal.filePath])

  const changes: Change[] = useMemo(() => {
    const { original, proposed } = computeCurrentAndProposed(
      currentContent,
      proposal
    )
    return diffLines(original, proposed)
  }, [currentContent, proposal])

  const isResolved = proposal.status !== 'pending'

  return (
    <div
      style={{
        marginTop: 'var(--space-2)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md, 6px)',
        background: 'var(--bg-base, #0b0f19)',
        overflow: 'hidden',
        fontSize: 'var(--text-xs)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          background: 'var(--bg-surface)',
        }}
      >
        <span
          style={{
            color: 'var(--accent, #6366f1)',
            fontWeight: 600,
          }}
        >
          Proposed edit
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono, monospace)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
          title={proposal.filePath}
        >
          {proposal.filePath}
        </span>
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: '10px',
            textTransform: 'uppercase',
          }}
        >
          {proposal.mode === 'replace_file' ? 'whole file' : 'range'}
        </span>
      </div>

      {/* Explanation */}
      {proposal.explanation && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            color: 'var(--text-secondary, var(--text-primary))',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          {proposal.explanation}
        </div>
      )}

      {/* Diff */}
      <div
        style={{
          maxHeight: 240,
          overflow: 'auto',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          lineHeight: 1.5,
        }}
      >
        {changes.map((c, i) => {
          const lines = c.value.replace(/\n$/, '').split('\n')
          return lines.map((line, j) => {
            const bg = c.added
              ? 'rgba(34,197,94,0.12)'
              : c.removed
                ? 'rgba(239,68,68,0.12)'
                : 'transparent'
            const color = c.added
              ? '#4ade80'
              : c.removed
                ? '#f87171'
                : 'var(--text-muted)'
            const marker = c.added ? '+' : c.removed ? '-' : ' '
            return (
              <div
                key={`${i}-${j}`}
                style={{
                  background: bg,
                  color,
                  padding: '0 var(--space-3)',
                  whiteSpace: 'pre',
                }}
              >
                {marker} {line}
              </div>
            )
          })
        })}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          gap: 'var(--space-2)',
          justifyContent: 'flex-end',
          background: 'var(--bg-surface)',
        }}
      >
        {isResolved ? (
          <span
            style={{
              color:
                proposal.status === 'accepted'
                  ? '#4ade80'
                  : 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
            }}
          >
            {proposal.status === 'accepted' ? '✓ Accepted' : 'Rejected'}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onReject(proposal.id)}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md, 6px)',
                padding: '4px 10px',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onAccept(proposal.id)}
              style={{
                background: 'var(--accent, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md, 6px)',
                padding: '4px 10px',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Accept
            </button>
          </>
        )}
      </div>
    </div>
  )
}
