const update = (br) => {
    let sym = [], addr = [];
    $('.symbol').each((idx, ele) => {
        sym.push($(ele).val()); 
    });
    $('.address').each((idx, ele) => {
        addr.push($(ele).val()); 
    });
    var l = sym.length > addr.length ? sym.length : addr.length;
    if (l == 0)
        return ;
    let bl = false;
    for(var i=0;i<l;i++){
        if (sym[i] === '' && addr[i] === ''){
            if (bl == true){
                console.log(i, 'must be deleted');
                $('.symbol').each((idx, ele) => {
                    if (idx == i){
                        var id = '#'+$(ele).attr('id');
                        $(id).parent().remove();
                    }
                });
                $('.address').each((idx, ele) => {
                    if (idx == i){
                        var id = '#'+$(ele).attr('id');
                        $(id).parent().remove();
                    }
                });
            }
            else
                bl = true;
        }
    }
    if (bl == false){
        var dyn_ele = $(`
        <div class="input-field first-wrap">
            <input name="sym${l}" id="sym${l}" class='symbol' type="text" placeholder="symbol" onclick='update(0)'/>
        </div>
        <div class="input-field second-wrap">
            <input name="addr${l}" id="addr${l}" class='address' type="text" placeholder="addr&0xfff (hex)" onclick='update(1)' />
        </div>
        `);
        $('.inner-form').append(dyn_ele);
        autocomp(`#sym${l}`);
    }
};
$(() => { // after load
    $('.address').on('input', () => {
        update(1);
    });
    $('.symbol').on('input', () => {
        update(0);
    });
    autocomp('.symbol')
});