/**
 * Pagination.test.tsx
 *
 * Covers:
 *  - Correct "Showing X–Y of Z" range text on each page
 *  - Prev disabled on page 0, enabled on page > 0
 *  - Next disabled on last page, enabled on earlier pages
 *  - onPageChange called with correct page number
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from '../components/shared/Pagination'

const PAGE_SIZE = 20

describe('Pagination', () => {
  it('shows "Showing 1–20 of 100" on the first page', () => {
    render(
      <Pagination page={0} total={100} pageSize={PAGE_SIZE} onPageChange={vi.fn()} />
    )
    expect(screen.getByText('Showing 1–20 of 100')).toBeInTheDocument()
  })

  it('shows "Showing 21–40 of 100" on page 2', () => {
    render(
      <Pagination page={1} total={100} pageSize={PAGE_SIZE} onPageChange={vi.fn()} />
    )
    expect(screen.getByText('Showing 21–40 of 100')).toBeInTheDocument()
  })

  it('clamps the upper bound on the last partial page', () => {
    render(
      <Pagination page={2} total={55} pageSize={PAGE_SIZE} onPageChange={vi.fn()} />
    )
    expect(screen.getByText('Showing 41–55 of 55')).toBeInTheDocument()
  })

  it('disables Prev on page 0', () => {
    render(
      <Pagination page={0} total={100} pageSize={PAGE_SIZE} onPageChange={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled()
  })

  it('disables Next on the last page', () => {
    render(
      <Pagination page={4} total={100} pageSize={PAGE_SIZE} onPageChange={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('calls onPageChange with page - 1 when Prev is clicked', async () => {
    const onChange = vi.fn()
    render(
      <Pagination page={2} total={100} pageSize={PAGE_SIZE} onPageChange={onChange} />
    )
    await userEvent.click(screen.getByRole('button', { name: /prev/i }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('calls onPageChange with page + 1 when Next is clicked', async () => {
    const onChange = vi.fn()
    render(
      <Pagination page={2} total={100} pageSize={PAGE_SIZE} onPageChange={onChange} />
    )
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('displays the correct page number', () => {
    render(
      <Pagination page={2} total={100} pageSize={PAGE_SIZE} onPageChange={vi.fn()} />
    )
    expect(screen.getByText('Page 3 of 5')).toBeInTheDocument()
  })
})
