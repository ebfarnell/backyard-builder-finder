/**
 * Reusable Input component with validation states
 */

import { forwardRef, InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  success?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, success, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={clsx(
            // Base styles
            'block w-full rounded-md border px-3 py-2 text-sm',
            'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            
            // State-based styles
            error
              ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
              : success
              ? 'border-green-300 text-green-900 focus:border-green-500 focus:ring-green-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
            
            // Custom className
            className
          )}
          ref={ref}
          {...props}
        />
        
        {error && (
          <p className="mt-1 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'