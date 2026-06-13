import dns from 'dns';

/** Windows often fails Node SRV lookups; public DNS fixes mongodb+srv:// URIs. */
export function configureMongoDns() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
