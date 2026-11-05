import {notFound} from 'next/navigation';
import {engineFulfillmentEnabled} from '@/lib/engine-site/fulfillment';
import {OperatorInbox} from './inbox';
export const dynamic='force-dynamic';
export const metadata={title:'תור המפעיל | גיבורים קטנים',robots:{index:false,follow:false},referrer:'no-referrer'};
export default function OperatorInboxPage(){if(!engineFulfillmentEnabled())notFound();return <OperatorInbox/>;}
