if [ "$(uname)" == "Darwin" ]; then
    bash ./zipNpush.sh activate_convo activate_convo
    bash ./zipNpush.sh block_convo block_convo
    bash ./zipNpush.sh block_post block_post
    bash ./zipNpush.sh collect_earnings collect_earnings
    bash ./zipNpush.sh create_community create_community
    bash ./zipNpush.sh create_convo create_convo
    bash ./zipNpush.sh create_message create_message
    bash ./zipNpush.sh create_post digitari_create_post
    bash ./zipNpush.sh distribute_post distribute_post
    bash ./zipNpush.sh dismiss_convo dismiss_convo
    bash ./zipNpush.sh donate_to_post donate_to_post
    bash ./zipNpush.sh finish_convo finish_convo
    bash ./zipNpush.sh follow_community follow_community
    bash ./zipNpush.sh follow_user follow_user
    bash ./zipNpush.sh transaction_accumulation transaction_accumulation
    bash ./zipNpush.sh unfollow_user unfollow_user
    bash ./zipNpush.sh unfollow_community unfollow_community
    bash ./zipNpush.sh update_profile_pic update_profile_pic
    bash ./zipNpush.sh delete_user delete_user
    bash ./zipNpush.sh delete_post delete_post
    bash ./zipNpush.sh gen_invite_code gen_invite_code
    bash ./zipNpush.sh create_user create_user
    bash ./zipNpush.sh process_iap process_iap
else
    ./zipNpush.sh activate_convo activate_convo
    ./zipNpush.sh block_convo block_convo
    ./zipNpush.sh block_post block_post
    ./zipNpush.sh collect_earnings collect_earnings
    ./zipNpush.sh create_community create_community
    ./zipNpush.sh create_convo create_convo
    ./zipNpush.sh create_message create_message
    ./zipNpush.sh create_post digitari_create_post
    ./zipNpush.sh distribute_post distribute_post
    ./zipNpush.sh dismiss_convo dismiss_convo
    ./zipNpush.sh donate_to_post donate_to_post
    ./zipNpush.sh finish_convo finish_convo
    ./zipNpush.sh follow_community follow_community
    ./zipNpush.sh follow_user follow_user
    ./zipNpush.sh transaction_accumulation transaction_accumulation
    ./zipNpush.sh unfollow_user unfollow_user
    ./zipNpush.sh unfollow_community unfollow_community
    ./zipNpush.sh update_profile_pic update_profile_pic
    ./zipNpush.sh delete_user delete_user
    ./zipNpush.sh delete_post delete_post
    ./zipNpush.sh gen_invite_code gen_invite_code
    ./zipNpush.sh create_user create_user
    ./zipNpush.sh process_iap process_iap
fi