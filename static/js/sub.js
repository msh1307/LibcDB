function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message || ''}`);
    }
}

const sub = () => {
    let req = {};
    let it = $('.symbol')
    let it1 = $('.address')
    assert(it.length == it1.length, 'length mismatch');
    for(var i=0; i<it.length; i++){
        req[$(it[i]).val()] = $(it1[i]).val();
    }
    console.log(req);
    $.ajax({
        url: '/api/get',
        type: 'post',
        accept: 'application/json',
        contentType: 'application/json; charset=utf-8',
        data: JSON.stringify(req),
        dataType: 'json',
        success: (data)=>{
            console.log('sent successfully');
            $('.out p').html(data['text']);
        },
        error: ()=>{
            console.log('err');
        }
    });
};

$(() => { // after load
    $('.btn-search').click(()=>{
        sub();
    });
});
