
import { Injectable } from '@angular/core';
import { EventsService } from './events.service';
import { UtilsService } from './utils.service';

import * as gConst from './gConst';
import * as gIF from './gIF';

@Injectable({
    providedIn: 'root',
})
export class UdpService {

    private dgram: any;
    public udpSocket: any;

    private msgBuf = new ArrayBuffer(1024);
    private msg: DataView = new DataView(this.msgBuf);

    srvValid: boolean = false;
    srvIP: string;
    srvPort: number;
    validTMO: any;

    constructor(private events: EventsService,
                private utils: UtilsService) {
        this.dgram = window.nw.require('dgram');
        this.udpSocket = this.dgram.createSocket('udp4');
        this.udpSocket.on('message', (msg: any, rinfo: any)=>{
            this.udpOnMsg(msg, rinfo);
        });
        this.udpSocket.on('error', (err: any)=>{
            console.log(`server error:\n${err.stack}`);
        });
        this.udpSocket.on('listening', ()=>{
            let address = this.udpSocket.address();
            console.log(`server listening ${address.address}:${address.port}`);
        });
        this.udpSocket.bind(gConst.UDP_PORT, ()=>{
            this.udpSocket.setBroadcast(true);
        });
    }

    /***********************************************************************************************
     * fn          udpOnMsg
     *
     * brief
     *
     */
    public udpOnMsg(msg: any, rem: any) {

        let msgBuf = this.utils.bufToArrayBuf(msg);
        let msgView = new DataView(msgBuf);

        let pktIdx = 0;
        let pktFunc = msgView.getUint16(pktIdx, gConst.LE);
        pktIdx += 2;
        switch(pktFunc) {
            case gConst.ID_RSP: {
                const devID = msgView.getUint16(pktIdx, gConst.LE);
                pktIdx += 2;
                switch(devID){
                    case gConst.DEV_ID_STM: {
                        console.log(`device OK on ${rem.address}`);
                        this.srvValid = true;
                        this.srvIP = rem.address;
                        this.srvPort = rem.port;

                        clearTimeout(this.validTMO);
                        this.validTMO = setTimeout(() => {
                            this.srvValid = false;
                        }, 3000);
                        break;
                    }
                }
                break;
            }
            case gConst.STM_REQ: {
                const cmdID = msgView.getUint16(pktIdx, gConst.LE);
                pktIdx += 2;
                switch(cmdID){
                    case gConst.STM_GET_THERMOSTAT: {
                        const tsSet = {} as gIF.tsSet_t;
                        tsSet.runFlag = msgView.getUint8(pktIdx++);
                        tsSet.tcTemp = msgView.getUint16(pktIdx, gConst.LE) / 4.0;
                        pktIdx += 2;
                        tsSet.setPoint = msgView.getUint16(pktIdx, gConst.LE) / 4.0;
                        pktIdx += 2;
                        tsSet.hist = msgView.getUint8(pktIdx++) / 4.0;
                        tsSet.duty = msgView.getUint8(pktIdx++);

                        this.events.publish('newTS', tsSet);
                        break;
                    }
                    case gConst.STM_GET_ID: {
                        const idGet = {} as gIF.idGet_t;
                        idGet.id = msgView.getUint16(pktIdx, gConst.LE);
                        pktIdx += 2;

                        this.events.publish('getID', idGet);
                        break;
                    }
                }
                break;
            }
            default:
                // ---
                break;
        }
    }

    /***********************************************************************************************
     * fn          getThermostat
     *
     * brief
     *
     */
    getThermostat() {

        let idx = 0;

        this.msg.setUint16(idx, gConst.STM_REQ, gConst.LE);
        idx += 2;
        this.msg.setUint16(idx, gConst.STM_GET_THERMOSTAT, gConst.LE);
        idx += 2;

        const len = idx;
        const bufData = this.utils.arrayBufToBuf(this.msgBuf.slice(0, len));

        if(this.srvValid == true){
            this.udpSocket.send(
                bufData,
                0,
                len,
                this.srvPort,
                this.srvIP,
                (err)=>{
                    if(err) {
                        console.log('get thermostat err: ' + JSON.stringify(err));
                    }
                }
            );
        }
    }

    /***********************************************************************************************
     * fn          setThermostat
     *
     * brief
     *
     */
    setThermostat(tsSet: gIF.tsSet_t) {

        let idx = 0;

        this.msg.setUint16(idx, gConst.STM_REQ, gConst.LE);
        idx += 2;
        this.msg.setUint16(idx, gConst.STM_SET_THERMOSTAT, gConst.LE);
        idx += 2;

        this.msg.setUint8(idx++, tsSet.runFlag);
        this.msg.setUint16(idx, tsSet.setPoint, gConst.LE);
        idx += 2;
        this.msg.setUint8(idx++, tsSet.hist);
        this.msg.setUint8(idx++, tsSet.duty);

        const len = idx;
        const bufData = this.utils.arrayBufToBuf(this.msgBuf.slice(0, len));

        if(this.srvValid == true){
            this.udpSocket.send(
                bufData,
                0,
                len,
                this.srvPort,
                this.srvIP,
                (err)=>{
                    if(err) {
                        console.log('set thermostat err: ' + JSON.stringify(err));
                    }
                }
            );
        }
    }

    /***********************************************************************************************
     * fn          getID
     *
     * brief
     *
     */
    getID() {

        let idx = 0;

        this.msg.setUint16(idx, gConst.STM_REQ, gConst.LE);
        idx += 2;
        this.msg.setUint16(idx, gConst.STM_GET_ID, gConst.LE);
        idx += 2;

        const len = idx;
        const bufData = this.utils.arrayBufToBuf(this.msgBuf.slice(0, len));

        if(this.srvValid == true){
            this.udpSocket.send(
                bufData,
                0,
                len,
                this.srvPort,
                this.srvIP,
                (err)=>{
                    if(err) {
                        console.log('get hot plate ID err: ' + JSON.stringify(err));
                    }
                }
            );
        }
    }
}
