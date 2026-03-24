import React, { createContext, useContext, useState, useCallback } from 'react'

type DialogType = 'alert' | 'confirm' | 'prompt'

interface DialogState {
    type: DialogType
    message: string
    resolve: (value: any) => void
}

interface DialogContextType {
    showAlert: (message: string) => Promise<void>
    showConfirm: (message: string) => Promise<boolean>
    showPrompt: (message: string, defaultValue?: string) => Promise<string | null>
}

const DialogContext = createContext<DialogContextType | null>(null)

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<DialogState | null>(null)
    const [inputValue, setInputValue] = useState('')

    const showAlert = useCallback((message: string): Promise<void> => {
        return new Promise(resolve => setDialog({ type: 'alert', message, resolve }))
    }, [])

    const showConfirm = useCallback((message: string): Promise<boolean> => {
        return new Promise(resolve => setDialog({ type: 'confirm', message, resolve }))
    }, [])

    const showPrompt = useCallback((message: string, defaultValue = ''): Promise<string | null> => {
        setInputValue(defaultValue)
        return new Promise(resolve => setDialog({ type: 'prompt', message, resolve }))
    }, [])

    const handleConfirm = () => {
        if (!dialog) return
        if (dialog.type === 'alert') dialog.resolve(undefined)
        else if (dialog.type === 'confirm') dialog.resolve(true)
        else dialog.resolve(inputValue)
        setDialog(null)
        setInputValue('')
    }

    const handleCancel = () => {
        if (!dialog) return
        if (dialog.type === 'confirm') dialog.resolve(false)
        else dialog.resolve(null)
        setDialog(null)
        setInputValue('')
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleConfirm()
        if (e.key === 'Escape') handleCancel()
    }

    const overlayStyle: React.CSSProperties = {
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999
    }

    const boxStyle: React.CSSProperties = {
        backgroundColor: '#fff', borderRadius: 12,
        padding: '24px 28px', maxWidth: 440, width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    }

    const btnBase: React.CSSProperties = {
        padding: '9px 18px', borderRadius: 8,
        cursor: 'pointer', fontSize: 14, fontWeight: 500
    }

    return (
        <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
            {children}
            {dialog && (
                <div style={overlayStyle} onClick={dialog.type === 'alert' ? handleConfirm : undefined}>
                    <div style={boxStyle} onClick={e => e.stopPropagation()}>
                        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.6, color: '#111827', whiteSpace: 'pre-line' }}>
                            {dialog.message}
                        </p>
                        {dialog.type === 'prompt' && (
                            <input
                                autoFocus
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{
                                    width: '100%', padding: '9px 12px', marginBottom: 16,
                                    border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15,
                                    outline: 'none', boxSizing: 'border-box'
                                }}
                            />
                        )}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {dialog.type !== 'alert' && (
                                <button onClick={handleCancel} style={{ ...btnBase, border: '1px solid #d1d5db', background: '#fff', color: '#374151' }}>
                                    Cancelar
                                </button>
                            )}
                            <button
                                autoFocus={dialog.type !== 'prompt'}
                                onClick={handleConfirm}
                                style={{ ...btnBase, border: 'none', background: '#111827', color: '#fff' }}
                            >
                                {dialog.type === 'alert' ? 'Aceptar' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    )
}

export function useDialog() {
    const ctx = useContext(DialogContext)
    if (!ctx) throw new Error('useDialog debe usarse dentro de DialogProvider')
    return ctx
}
