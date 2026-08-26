import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from './index';

interface PrintableProps {
    children: React.ReactNode;
    title?: string;
    buttonText?: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

// Print happens via the browser dialog; @media print rules in index.css
// isolate .print-area and hide .no-print (the button bar, app chrome).
export const Printable: React.FC<PrintableProps> = ({
    children,
    title = 'Cetak Dokumen',
    buttonText = 'Cetak',
    variant = 'secondary'
}) => {
    const handlePrint = () => {
        const prevTitle = document.title;
        document.title = title;
        window.print();
        document.title = prevTitle;
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }} className="no-print">
                <Button variant={variant} onClick={handlePrint} title={title}>
                    <Printer size={16} /> {buttonText}
                </Button>
            </div>

            {/* The actual printable area */}
            <div className="print-area" style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#000' }}>
                {children}
            </div>
        </div>
    );
};
