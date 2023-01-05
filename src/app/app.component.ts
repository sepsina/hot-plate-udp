import { Component, HostListener, OnDestroy, OnInit, NgZone, ViewChild, ElementRef } from '@angular/core';
import { EventsService } from './events.service';
import { UdpService } from './udp.service';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import * as gConst from './gConst';
import * as gIF from './gIF';
//import * as regression from 'regression'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy{

    @ViewChild('tsRunFlag') runFlag: ElementRef;
    @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

    @HostListener('document:keyup', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent) {
        switch(event.key){
            case 'Escape': {
                console.log(`escape pressed`);
                break;
            }
        }
    }
    tc = '-- degC';

    tsRunFlag = 0;
    tsSetPoint = 20;
    tsHist = 1;
    tsDuty = 50;

    tsStatus = '';
    syncFlag = true;
    syncDis = false;

    chartLen = 25;
    chartTime: number[] = [];
    secTime: number[] = [];

    validDevice = false;
    validDeviceTMO: any;

    constructor(public udp: UdpService,
                public events: EventsService,
                public ngZone: NgZone) {
        // ---
    }

    /***********************************************************************************************
     * fn          ngOnInit
     *
     * brief
     *
     */
    ngOnInit() {

        this.events.subscribe('newTS', (msg: gIF.tsSet_t)=>{
            this.newTS(msg);
        });
        this.events.subscribe('getID', (msg: gIF.idGet_t)=>{
            this.getID(msg);
        });

        window.onbeforeunload = ()=>{
            this.ngOnDestroy();
        };

        for(let i = 0; i < this.chartLen; i++){
            this.lineChartData.labels[i] = '';
            this.lineChartData.datasets[0].data[i] = null;
            //this.lineChartData.datasets[1].data[i] = null;
            this.chartTime.push(0);
            this.secTime.push(0);
        }
        setTimeout(()=>{
            this.rdThemostat();
            this.checkID();
        }, 1000);
    }

    /***********************************************************************************************
     * fn          rdThemostat
     *
     * brief
     *
     */
    rdThemostat() {
        if(this.validDevice === true){
            this.udp.getThermostat();
        }
        else {
            const tsSet = {} as gIF.tsSet_t;
            tsSet.runFlag = 0;
            tsSet.setPoint = this.tsSetPoint;
            tsSet.tcTemp = null;
            tsSet.hist = this.tsHist;
            tsSet.duty = this.tsDuty;
            this.newTS(tsSet);
        }
        setTimeout(()=>{
            this.rdThemostat();
        }, 2000);
    }

    /***********************************************************************************************
     * fn          ngOnDestroy
     *
     * brief
     *
     */
     ngOnDestroy() {
        this.udp.udpSocket.close();
    }

    /***********************************************************************************************
     * fn          newTS
     *
     * brief
     *
     */
    newTS(msg: gIF.tsSet_t){

        const now = Math.floor(Date.now()/1000);
        this.chartTime.shift();
        this.chartTime.push(now);
        const start = this.chartTime[0];
        if(start > 0){
            for(let i = 0; i < this.chartLen; i++){
                this.secTime[i] = this.chartTime[i] - start;
            }
            this.lineChartData.labels[0] = 0;
            this.lineChartData.labels[this.chartLen - 1] = this.secTime[this.chartLen - 1];
        }

        this.lineChartData.datasets[0].data.shift();
        if((this.validDevice === true) && (msg.runFlag === 1)){
            this.lineChartData.datasets[0].data.push(msg.tcTemp);
        }
        else {
            this.lineChartData.datasets[0].data.push(null);
        }
        this.ngZone.run(()=>{
            if((this.validDevice === true) && (msg.runFlag === 1)){
                this.tc = `tc: ${msg.tcTemp.toFixed(1)} degC`;
            }
            else {
                this.tc = `tc: --.- degC`;
            }
        });
        /*
        if(start){
            const startIdx = 15;
            const yCord = this.lineChartData.datasets[0].data.slice(startIdx);
            const xCord = this.secTime.slice(startIdx);
            const coords = xCord.map((el, index)=> [el, yCord[index]]);
            console.log(coords);
            const result = regression.linear(coords);
            console.log(result);
            for(let i = startIdx, j = 0; i < this.chartLen; i++, j++){
                this.lineChartData.datasets[1].data[i] = result.points[j][1];
            }
        }
        */
        this.tsRunFlag = 0;
        if(this.runFlag.nativeElement.checked){
            this.tsRunFlag = 1;
        }
        this.syncDis = false;
        if(this.udp.srvValid === true){
            if(this.validDevice === true){
                this.tsStatus = `status: ${msg.runFlag?'run':'idle'};`;
                this.tsStatus += ` SP: ${msg.setPoint};`;
                this.tsStatus += ` hist: ${msg.hist};`;
                this.tsStatus += ` duty: ${msg.duty}`;
                if(msg.runFlag === this.tsRunFlag){
                    if(msg.setPoint === this.tsSetPoint){
                        if(msg.hist === this.tsHist){
                            if(msg.duty === this.tsDuty){
                                this.syncDis = true;
                            }
                        }
                    }
                }
            }
            else {
                this.tsStatus = `status: no valid device`;
            }
        }
        else {
            this.tsStatus = `status: no hot-plate`;
        }
        if(this.validDevice === true){
            if(this.syncFlag){
                this.syncFlag = false;
                this.ngZone.run(()=>{
                    this.runFlag.nativeElement.checked = msg.runFlag ? true : false;
                    this.tsSetPoint = msg.setPoint;
                    this.tsHist = msg.hist;
                    this.tsDuty = msg.duty;
                });
            }
        }

        this.chart.update();
    }

    /***********************************************************************************************
     * fn          setThermostat
     *
     * brief
     *
     */
    setThermostat() {

        const tsSet = {} as gIF.tsSet_t;

        this.tsRunFlag = 0;
        if(this.runFlag.nativeElement.checked){
            this.tsRunFlag = 1;
        }

        tsSet.runFlag = this.tsRunFlag;
        tsSet.setPoint = this.tsSetPoint * 4;
        tsSet.hist = this.tsHist * 4;
        tsSet.duty = this.tsDuty

        console.log(tsSet);

        this.udp.setThermostat(tsSet);
    }

    lineChartData: ChartConfiguration<'line'> ['data'] = {
        labels: [],
        datasets: [
            {
                data: [],
                label: 'temp',
                fill: false,
                borderColor: 'black',
                cubicInterpolationMode: 'monotone',
            },
            /*
            {
                data: [],
                label: 'lin reg',
                fill: false,
                borderColor: 'red',
                borderDash: [8, 4],
                borderWidth: 2,
                cubicInterpolationMode: 'monotone',
            }
            */
        ]
    };
    public lineChartOptions: ChartOptions<'line'> = {
        responsive: true,
        //borderColor: 'blue',
        scales: {
            x: {
                border: {
                    color: 'lightgray'
                },
                grid: {
                    display: false
                },
                ticks: {
                    display: true,
                    maxRotation: 0,
                    font: {
                        size: 14,
                        //family: 'Verdana'
                    }
                }
            },
            y: {
                border: {
                    dash: [8, 4],
                    color: 'lightgray'
                },
                grid: {
                    //tickColor: 'red',
                    color: 'lightgray',
                    display: true,
                },
                ticks:{
                    //maxTicksLimit: 6,
                    font: {
                        size: 14,
                        //family: 'Verdana'
                    }
                },
                /*
                title: {
                    display: true,
                    text: 'temperatures',
                    font: {
                        size: 14,
                    }
                },
                */
                grace: 1,
            }
        },
        elements: {
            point:{
                radius: 0
            }
        },
        animation: {
            duration: 0
        }
    };

    public lineChartLegend = false;

    /***********************************************************************************************
     * fn          checkID
     *
     * brief
     *
     */
    checkID(){

        this.udp.getID();

        setTimeout(()=>{
            this.checkID();
        }, 2000);
    }

    /***********************************************************************************************
     * fn          getID
     *
     * brief
     *
     */
    getID(msg: gIF.idGet_t){

        if(msg.id === gConst.HOT_PLATE_ID){
            this.validDevice = true;
            console.log('valid device');
            clearTimeout(this.validDeviceTMO);
            this.validDeviceTMO = setTimeout(() => {
                this.validDevice = false;
            }, gConst.VALID_DEVICE_TMO);

        }
    }
}
