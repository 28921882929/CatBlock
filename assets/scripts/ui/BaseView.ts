import { _decorator, Component } from 'cc';
import { EventBus } from '../core/EventBus';

const { ccclass } = _decorator;

/**
 * 所有 UI 页面组件的基类。
 * 子类可覆写打开和关闭钩子；销毁时会自动清理以自身为所有者的事件。
 */
@ccclass('BaseView')
export class BaseView extends Component {
    /** 页面显示后的业务入口。 */
    public onOpen(_data?: unknown): void {}

    /** 页面隐藏或销毁前的业务入口。 */
    public onClose(): void {}

    /** 清理页面生命周期内注册的全局事件。 */
    protected onDestroy(): void {
        EventBus.clearOwner(this);
    }
}
