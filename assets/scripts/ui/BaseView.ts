import { _decorator, Component } from 'cc';
import { EventBus } from '../core/EventBus';

const { ccclass } = _decorator;

@ccclass('BaseView')
export class BaseView extends Component {
    public onOpen(_data?: unknown): void {}

    public onClose(): void {}

    protected onDestroy(): void {
        EventBus.clearOwner(this);
    }
}
