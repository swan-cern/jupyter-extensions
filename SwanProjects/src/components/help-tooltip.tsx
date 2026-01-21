import React from 'react';
import ReactTooltip from 'react-tooltip';

export function HelpTooltip(props: {
    id: string;
    message: string;
}): React.ReactElement<any> {
    return (
        <div className="sw-Component-tooltip">
            <a data-for={props.id} data-tip={props.message}>
                ?
            </a>
            <ReactTooltip
                html={true}
                id={props.id}
                multiline={true}
                getContent={(dataTip): string => `${dataTip}`}
            />
        </div>
    );
}

