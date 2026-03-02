import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import { Button } from './index';

interface PrintableProps {
    children: React.ReactNode;
    title?: string;
    buttonText?: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

// A reusable wrapper component that provides a "Print" button
// and handles printing its children elegantly.
export const Printable: React.FC<PrintableProps> = ({
    children,
    title = 'Cetak Dokumen',
    buttonText = 'Cetak',
    variant = 'secondary'
}) => {
    const componentRef = useRef<HTMLDivElement>(null);

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: title,
        pageStyle: `
            @page { size: auto; margin: 20mm; }
            @media print {
                body { -webkit-print-color-adjust: exact; background: transparent; }
                .no-print { display: none !important; }
            }
        `,
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }} className="no-print">
                <Button variant={variant} onClick={handlePrint} title={title}>
                    <Printer size={16} /> {buttonText}
                </Button>
            </div>

            {/* The actual printable area */}
            <div ref={componentRef} style={{ background: '#fff', padding: '24px', borderRadius: '8px', color: '#000' }}>
                {children}
            </div>
        </div>
    );
};
